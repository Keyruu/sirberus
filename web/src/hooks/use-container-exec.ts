import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface ExecStatus {
	isRunning: boolean;
	error: string | null;
}

export function useContainerExec(containerId: string) {
	const [output, setOutput] = useState<string[]>([]);
	const [status, setStatus] = useState<ExecStatus>({
		isRunning: false,
		error: null,
	});
	const eventSourceRef = useRef<EventSource | null>(null);

	// Function to execute a command
	const executeCommand = useCallback(
		async (command: string) => {
			if (!containerId || !command) {
				toast.error('Container ID and command are required');
				return;
			}

			// Close existing connection if any
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}

			setStatus({ isRunning: true, error: null });
			setOutput([]); // Clear existing output

			try {
				// Start the exec request
				await axios.post(`/api/container/${containerId}/exec`, { command });

				// Create a new EventSource connection for streaming the output
				const eventSourceUrl = `/api/container/${containerId}/exec/output`;
				const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });
				eventSourceRef.current = eventSource;

				// Handle incoming output events
				eventSource.addEventListener('output', (event: Event & { data?: string }) => {
					try {
						const outputText = event.data || '';
						setOutput(prev => [...prev, outputText]);
					} catch (err) {
						console.error('Error parsing output:', err);
					}
				});

				// Handle error events
				eventSource.addEventListener('error', (event: Event & { data?: string }) => {
					console.error('EventSource error:', event);
					const errorMessage = event.data || 'Failed to execute command';
					setStatus({ isRunning: false, error: errorMessage });
					eventSource.close();
				});

				// Handle completion event
				eventSource.addEventListener('done', () => {
					setStatus({ isRunning: false, error: null });
					eventSource.close();
					eventSourceRef.current = null;
				});
			} catch (err) {
				console.error('Error executing command:', err);
				setStatus({
					isRunning: false,
					error: err instanceof Error ? err.message : 'Failed to execute command',
				});
			}
		},
		[containerId]
	);

	// Function to cancel execution
	const cancelExecution = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setStatus(prev => ({ ...prev, isRunning: false }));
	}, []);

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	return {
		output,
		status,
		executeCommand,
		cancelExecution,
	};
}
