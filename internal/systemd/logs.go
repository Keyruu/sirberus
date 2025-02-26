package systemd

import (
	"context"
	"fmt"
	"time"

	"github.com/coreos/go-systemd/v22/sdjournal"
)

type LogEntry struct {
	// Timestamp of the log entry
	Timestamp time.Time
	// Message content
	Message string
	// Unit name that generated the log
	UnitName string
}

func (e LogEntry) String() string {
	return fmt.Sprintf("%s: %s", e.Timestamp.Format(time.RFC3339), e.Message)
}

func (s *SystemdService) StreamServiceLogs(ctx context.Context, unitName string, follow bool, numLines int) (<-chan string, <-chan error) {
	logCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(logCh)
		defer close(errCh)

		journal, err := sdjournal.NewJournal()
		if err != nil {
			errCh <- fmt.Errorf("failed to open systemd journal for unit %s: %w", unitName, err)
			return
		}
		defer journal.Close()

		if err := journal.AddMatch(journalUnitField + "=" + unitName); err != nil {
			errCh <- fmt.Errorf("failed to add unit match for %s: %w", unitName, err)
			return
		}

		if err := s.positionJournalCursor(journal, follow, numLines); err != nil {
			errCh <- err
			return
		}

		s.processJournalEntries(ctx, journal, unitName, follow, logCh, errCh)
	}()

	return logCh, errCh
}

func (s *SystemdService) positionJournalCursor(journal *sdjournal.Journal, follow bool, numLines int) error {
	if err := journal.SeekTail(); err != nil {
		return fmt.Errorf("failed to seek to tail: %w", err)
	}

	if follow {
		if _, err := journal.Previous(); err != nil {
			s.logger.Warn("failed to move to previous entry, might be empty journal", "error", err)
		}
		return nil
	}

	if numLines > 0 {
		for i := 0; i < numLines; i++ {
			if _, err := journal.Previous(); err != nil {
				break // Reached the beginning of the journal
			}
		}
	}

	return nil
}

func (s *SystemdService) processJournalEntries(
	ctx context.Context,
	journal *sdjournal.Journal,
	unitName string,
	follow bool,
	logCh chan<- string,
	errCh chan<- error,
) {
	for {
		select {
		case <-ctx.Done():
			errCh <- ctx.Err()
			return
		default:
			if follow {
				waitResult := journal.Wait(journalWaitTimeout)
				if waitResult == sdjournal.SD_JOURNAL_NOP {
					continue // No new entries yet
				}
			}

			n, err := journal.Next()
			if err != nil {
				errCh <- fmt.Errorf("error reading journal for unit %s: %w", unitName, err)
				return
			}

			if n == 0 {
				if !follow {
					return // We're done if not following
				}
				continue // Wait for more entries if following
			}

			entry, err := s.formatLogEntry(journal, unitName)
			if err != nil {
				s.logger.Warn("failed to format log entry", "error", err, "unit", unitName)
				continue
			}

			select {
			case logCh <- entry:
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			}
		}
	}
}

func (s *SystemdService) formatLogEntry(journal *sdjournal.Journal, unitName string) (string, error) {
	message, err := journal.GetDataValue(journalMessageField)
	if err != nil {
		return "", fmt.Errorf("failed to get message from journal entry: %w", err)
	}

	var timestamp time.Time
	if realtime, err := journal.GetRealtimeUsec(); err == nil {
		seconds := int64(realtime / microsecondsPerSecond)
		nanoseconds := int64((realtime % microsecondsPerSecond) * nanosecondsPerMicrosecond)
		timestamp = time.Unix(seconds, nanoseconds)
	} else {
		timestamp = time.Now()
	}

	entry := LogEntry{
		Timestamp: timestamp,
		Message:   message,
		UnitName:  unitName,
	}

	return entry.String(), nil
}
