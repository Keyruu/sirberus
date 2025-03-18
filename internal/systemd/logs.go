package systemd

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type LogEntry struct {
	// Timestamp of the log entry as a string
	Timestamp string
	// Message content
	Message string
	// Unit name that generated the log
	UnitName string
}

func (e LogEntry) String() string {
	// Pass the timestamp directly to the frontend
	return fmt.Sprintf("%s: %s", e.Timestamp, e.Message)
}

// StreamServiceLogs retrieves the last numLines log entries for the specified unit
// and then continues streaming new logs as they arrive
// The follow parameter is ignored - we always stream real-time updates
func (s *SystemdService) StreamServiceLogs(ctx context.Context, unitName string, follow bool, numLines int) (<-chan string, <-chan error) {
	logCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(logCh)
		defer close(errCh)

		// Ensure numLines is at least 1
		count := numLines
		if count <= 0 {
			count = 1
		}

		s.logger.Info("starting journalctl log streaming",
			"unit", unitName,
			"lines", count)

		// Start journalctl process with appropriate flags
		// -u: unit name
		// -f: follow (real-time updates)
		// -n: number of lines
		// -o: output format (short-iso includes timestamps)
		cmd := exec.CommandContext(ctx, "journalctl", "-u", unitName, "-f", "-n", fmt.Sprintf("%d", count), "-o", "short-iso")

		// Get stdout pipe
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			errCh <- fmt.Errorf("failed to get stdout pipe: %w", err)
			return
		}

		// Get stderr pipe
		stderr, err := cmd.StderrPipe()
		if err != nil {
			errCh <- fmt.Errorf("failed to get stderr pipe: %w", err)
			return
		}

		// Start the command
		if err := cmd.Start(); err != nil {
			errCh <- fmt.Errorf("failed to start journalctl: %w", err)
			return
		}

		// We still need to cancel any resources when the function returns
		_, cancel := context.WithCancel(ctx)
		defer cancel()

		// Handle stderr in a separate goroutine
		go func() {
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				errText := scanner.Text()
				s.logger.Warn("journalctl stderr", "text", errText)
			}
		}()

		// Process stdout
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()

			// Parse the log entry
			entry, err := s.parseJournalctlLine(line, unitName)
			if err != nil {
				s.logger.Warn("failed to parse journalctl line", "error", err, "line", line)
				continue
			}

			select {
			case logCh <- entry:
			case <-ctx.Done():
				// Context canceled, stop processing
				if cmd.Process != nil {
					if err := cmd.Process.Kill(); err != nil {
						s.logger.Warn("failed to kill journalctl process on context done", "error", err)
					}
				}
				errCh <- ctx.Err()
				return
			}
		}

		// Check for scanner errors
		if err := scanner.Err(); err != nil {
			s.logger.Warn("scanner error", "error", err)
		}

		// Wait for the command to finish
		err = cmd.Wait()

		// If the context was canceled, this is expected
		if ctx.Err() != nil {
			return
		}

		// If we get here and there's no context error, the journalctl process exited unexpectedly
		// Start a new journalctl process
		s.logger.Info("journalctl process exited, restarting", "unit", unitName, "error", err)

		// Small delay before restarting
		select {
		case <-ctx.Done():
			return
		case <-time.After(500 * time.Millisecond):
		}

		// Recursively call StreamServiceLogs to restart the process
		newLogCh, newErrCh := s.StreamServiceLogs(ctx, unitName, follow, 10) // Only get the last 10 lines on restart

		// Forward logs and errors from the new channels
		for {
			select {
			case log, ok := <-newLogCh:
				if !ok {
					return
				}
				logCh <- log
			case err, ok := <-newErrCh:
				if !ok {
					return
				}
				errCh <- err
			case <-ctx.Done():
				return
			}
		}
	}()

	return logCh, errCh
}

// parseJournalctlLine parses a line from journalctl output
// Format example: "2023-03-17T20:53:05+0100 hostname systemd[1]: Started My Service."
func (s *SystemdService) parseJournalctlLine(line string, unitName string) (string, error) {
	// Find the first space which separates the timestamp from the rest
	timestampEndIndex := strings.Index(line, " ")
	if timestampEndIndex <= 0 {
		return "", fmt.Errorf("invalid journalctl line format: %s", line)
	}

	// Extract timestamp string directly without parsing
	timestampStr := line[:timestampEndIndex]

	// Extract message (everything after the timestamp)
	fullMessage := strings.TrimSpace(line[timestampEndIndex+1:])

	// Split the message by spaces
	parts := strings.SplitN(fullMessage, " ", 2)

	// If we have at least 2 parts, the first part is the hostname, so skip it
	message := fullMessage
	if len(parts) >= 2 {
		// Skip the hostname, keep everything else
		message = parts[1]
	}

	// Create log entry
	entry := LogEntry{
		Timestamp: timestampStr,
		Message:   message,
		UnitName:  unitName,
	}

	return entry.String(), nil
}
