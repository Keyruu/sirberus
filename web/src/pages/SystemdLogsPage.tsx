import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceControls } from '@/components/systemd/service-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetSystemdName } from '@/generated/systemd/systemd';
import { isServiceRunning } from '@/lib/utils';
import { ArrowLeft, Download, FileWarning, Pause, Play, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

interface LogEntry {
	timestamp: string;
	message: string;
}

export default function SystemdLogsPage() {
	const { serviceName } = useParams<{ serviceName: string }>();
	const navigate = useNavigate();
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isStreaming, setIsStreaming] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
	const [filterText, setFilterText] = useState('');
	const [numLines, setNumLines] = useState('100');
	const logsContainerRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	// Fetch service details to show service status
	const { data: serviceData, isLoading: isLoadingService } = useGetSystemdName(serviceName || '', {
		query: {
			enabled: !!serviceName,
			refetchInterval: 5000, // Refresh service details every 5 seconds
		},
	});

	const service = serviceData?.data?.service;

	// Function to start streaming logs
	const startStreaming = useCallback(() => {
		if (!serviceName) return;

		// Close existing connection if any
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setIsStreaming(true);
		setError(null);
		setLogs([]); // Clear existing logs when starting a new stream

		try {
			// Create a new EventSource connection
			const eventSourceUrl = `/api/systemd/${serviceName}/logs?lines=${numLines}`;

			// Check if EventSource is supported
			if (typeof EventSource === 'undefined') {
				console.error('EventSource is not supported in this browser');
				setError('Server-Sent Events are not supported in this browser');
				setIsStreaming(false);
				return;
			}

			// Create a new EventSource connection with credentials
			const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });
			eventSourceRef.current = eventSource;

			// Handle incoming log events
			eventSource.addEventListener('log', (event: Event & { data?: string }) => {
				try {
					const logText = event.data || '';

					// Parse the log entry (format: "YYYY-MM-DDTHH:MM:SS+00:00: Message content")
					const timestampEndIndex = logText.indexOf(': ');
					if (timestampEndIndex > 0) {
						const timestamp = logText.substring(0, timestampEndIndex);
						const message = logText.substring(timestampEndIndex + 2);

						setLogs(prevLogs => [...prevLogs, { timestamp, message }]);
					} else {
						// If we can't parse the timestamp, just use the whole message
						setLogs(prevLogs => [...prevLogs, { timestamp: new Date().toISOString(), message: logText }]);
					}
				} catch (err) {
					console.error('Error parsing log entry:', err);
				}
			});

			// Handle error events
			eventSource.addEventListener('error', (event: Event & { data?: string }) => {
				console.error('EventSource error:', event);
				console.error('EventSource readyState on error:', eventSource.readyState);

				// Check if the connection was closed
				if (eventSource.readyState === 2) {
					console.error('EventSource connection closed due to error');
				}

				// Try to get more information about the error
				const target = event.target as EventSource;
				console.error('EventSource target:', target);

				const errorMessage = event.data || 'Failed to connect to log stream';
				console.error('Error message:', errorMessage);
				setError(errorMessage);
				setIsStreaming(false);
				eventSource.close();
			});

			// Handle connection close
			eventSource.addEventListener('close', () => {
				setIsStreaming(false);
			});
		} catch (err) {
			console.error('Error setting up EventSource:', err);
			setError('Failed to connect to log stream');
			setIsStreaming(false);
		}
	}, [serviceName, numLines]);

	// Function to stop streaming logs
	const stopStreaming = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setIsStreaming(false);
	}, []);

	// Function to clear logs and refresh
	const clearLogs = useCallback(() => {
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
		a.download = `${serviceName}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [logs, serviceName]);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (isAutoScrollEnabled && logsContainerRef.current) {
			logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
		}
	}, [logs, isAutoScrollEnabled]);

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
		if (isStreaming) {
			startStreaming();
		}
	}, [numLines, startStreaming, isStreaming]);

	// Filter logs based on filterText
	const filteredLogs = filterText
		? logs.filter(log => log.message.toLowerCase().includes(filterText.toLowerCase()))
		: logs;

	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<Button variant="outline" size="icon" onClick={() => navigate('/systemd')}>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<h1 className="text-2xl font-bold">{serviceName} Logs</h1>
					{!isLoadingService && service && (
						<>
							<Badge className={isServiceRunning(service) ? 'bg-green-500' : 'bg-gray-500'}>
								{isServiceRunning(service) ? 'Running' : service.activeState || 'Unknown'}
							</Badge>
							<div className="ml-4">
								<ServiceControls serviceName={serviceName || ''} service={service} showViewLogs={false} />
							</div>
						</>
					)}
				</div>
				<div className="flex items-center space-x-2">
					<Select value={numLines} onValueChange={setNumLines}>
						<SelectTrigger className="w-[100px]">
							<SelectValue placeholder="Lines" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="50">50 lines</SelectItem>
							<SelectItem value="100">100 lines</SelectItem>
							<SelectItem value="500">500 lines</SelectItem>
							<SelectItem value="1000">1000 lines</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="icon"
						onClick={isStreaming ? stopStreaming : startStreaming}
						title={isStreaming ? 'Pause streaming' : 'Resume streaming'}
					>
						{isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
					</Button>
					<Button variant="outline" size="icon" onClick={clearLogs} title="Refresh logs">
						<RefreshCw className="h-4 w-4" />
					</Button>
					<Button variant="outline" size="icon" onClick={downloadLogs} title="Download logs">
						<Download className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="flex items-center space-x-4">
				<div className="flex-1">
					<Input
						placeholder="Filter logs..."
						value={filterText}
						onChange={e => setFilterText(e.target.value)}
						className="w-full"
					/>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="auto-scroll"
						checked={isAutoScrollEnabled}
						onCheckedChange={checked => setIsAutoScrollEnabled(checked as boolean)}
					/>
					<Label htmlFor="auto-scroll">Auto-scroll</Label>
				</div>
			</div>

			{error && (
				<Alert variant="destructive">
					<FileWarning className="h-4 w-4" />
					<AlertTitle>Could not fetch logs</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{isLoadingService ? (
				<div className="space-y-3">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : (
				<div
					ref={logsContainerRef}
					className="h-[calc(100vh-250px)] overflow-y-auto border rounded-md bg-black text-gray-200 font-mono text-sm p-4"
				>
					{filteredLogs.length === 0 ? (
						<div className="flex items-center justify-center h-full">
							<Alert variant="info" className="max-w-md">
								<FileWarning className="h-4 w-4" />
								<AlertTitle>{isStreaming ? 'Waiting for logs...' : 'No logs available'}</AlertTitle>
								<AlertDescription>
									{isStreaming
										? 'Log entries will appear here as they are received from the service.'
										: 'There are no log entries to display for this service.'}
								</AlertDescription>
							</Alert>
						</div>
					) : (
						<div className="space-y-1">
							{filteredLogs.map((log, index) => (
								<div key={index} className="whitespace-pre-wrap break-all">
									<span className="text-blue-400">{log.timestamp}</span>: {log.message}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			<div className="text-sm text-muted-foreground">
				{filteredLogs.length} log entries {filterText && `(filtered from ${logs.length})`}
			</div>
		</div>
	);
}
