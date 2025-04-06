import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface LogEntry {
	timestamp: string;
	message: string;
}

interface LogsStatus {
	isStreaming: boolean;
	error: string | null;
}

export function useContainerLogs(containerId: string, numLines: string) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [status, setStatus] = useState<LogsStatus>({
		isStreaming: true,
		error: null,
	});
	const eventSourceRef = useRef<EventSource | null>(null);

	// Function to start streaming logs
	const startStreaming = useCallback(() => {
		if (!containerId) return;

		// Close existing connection if any
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setStatus({ isStreaming: true, error: null });
		setLogs([]); // Clear existing logs when starting a new stream

		try {
			// Create a new EventSource connection
			const eventSourceUrl = `/api/container/${containerId}/logs?lines=${numLines}`;

			// Check if EventSource is supported
			if (typeof EventSource === 'undefined') {
				console.error('EventSource is not supported in this browser');
				setStatus({
					isStreaming: false,
					error: 'Server-Sent Events are not supported in this browser',
				});
				return;
			}

			// Create a new EventSource connection with credentials
			const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });
			eventSourceRef.current = eventSource;

			// Handle incoming log events
			eventSource.addEventListener('output', (event: Event & { data?: string }) => {
				try {
					const logText = event.data || '';

					// Parse the log entry (format may differ from systemd logs)
					const timestampEndIndex = logText.indexOf(' ');
					if (timestampEndIndex > 0) {
						const timestamp = logText.substring(0, timestampEndIndex);
						const message = logText.substring(timestampEndIndex + 1);

						setLogs(prevLogs => [...prevLogs, { timestamp, message }]);
					} else {
						// If we can't parse the timestamp, just use the whole message
						setLogs(prevLogs => [
							...prevLogs,
							{
								timestamp: new Date().toISOString(),
								message: logText,
							},
						]);
					}
				} catch (err) {
					console.error('Error parsing log entry:', err);
				}
			});

			// Handle error events
			eventSource.addEventListener('error', (event: Event & { data?: string }) => {
				console.error('EventSource error:', event);
				const errorMessage = event.data || 'Failed to connect to log stream';
				setStatus({ isStreaming: false, error: errorMessage });
				eventSource.close();
			});

			// Handle connection close
			eventSource.addEventListener('close', () => {
				setStatus(prev => ({ ...prev, isStreaming: false }));
			});
		} catch (err) {
			console.error('Error setting up EventSource:', err);
			setStatus({
				isStreaming: false,
				error: 'Failed to connect to log stream',
			});
		}
	}, [containerId, numLines]);

	// Function to stop streaming logs
	const stopStreaming = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setStatus(prev => ({ ...prev, isStreaming: false }));
	}, []);

	// Function to clear logs and refresh
	const clearAndRefresh = useCallback(() => {
		setLogs([]);
		// Restart streaming to fetch new logs
		startStreaming();
	}, [startStreaming]);

	// Function to download logs
	const downloadLogs = useCallback(() => {
		if (logs.length === 0) {
			toast.warning('No logs to download');
			return;
		}

		const logText = logs.map(log => `${log.timestamp}: ${log.message}`).join('\n');
		const blob = new Blob([logText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `container-${containerId}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [logs, containerId]);

	// Start streaming logs on component mount
	useEffect(() => {
		startStreaming();

		// Clean up on unmount
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, [startStreaming]);

	// Restart streaming when numLines changes
	useEffect(() => {
		if (status.isStreaming) {
			startStreaming();
		}
	}, [numLines, startStreaming, status.isStreaming]);

	return {
		logs,
		status,
		controls: {
			startStreaming,
			stopStreaming,
			clearAndRefresh,
			downloadLogs,
		},
	};
}
