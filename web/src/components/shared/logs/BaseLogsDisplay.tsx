import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FileWarning } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface LogEntry {
	timestamp: string;
	message: string;
}

export interface BaseLogsDisplayProps {
	logs: LogEntry[];
	isLoading?: boolean;
	isStreaming?: boolean;
	isAutoScrollEnabled?: boolean;
	height?: string;
	className?: string;
}

export function BaseLogsDisplay({
	logs,
	isLoading = false,
	isStreaming = false,
	isAutoScrollEnabled = false,
	height = 'h-[calc(100vh-250px)]',
	className = '',
}: BaseLogsDisplayProps) {
	const logsContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (isAutoScrollEnabled && logsContainerRef.current) {
			logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
		}
	}, [logs, isAutoScrollEnabled]);

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	return (
		<div
			ref={logsContainerRef}
			className={`${height} overflow-y-auto border rounded-md bg-black text-gray-200 font-mono text-sm p-4 ${className}`}
		>
			{logs.length === 0 ? (
				<div className="flex items-center justify-center h-full">
					<Alert variant="info" className="max-w-md">
						<FileWarning className="h-4 w-4" />
						<AlertTitle>{isStreaming ? 'Waiting for logs...' : 'No logs available'}</AlertTitle>
						<AlertDescription>
							{isStreaming
								? 'Log entries will appear here as they are received.'
								: 'There are no log entries to display.'}
						</AlertDescription>
					</Alert>
				</div>
			) : (
				<div className="space-y-1">
					{logs.map((log, index) => (
						<LogEntry key={index} log={log} />
					))}
				</div>
			)}
		</div>
	);
}

interface LogEntryProps {
	log: LogEntry;
}

function LogEntry({ log }: LogEntryProps) {
	return (
		<div className="whitespace-pre-wrap break-all">
			<span className="text-blue-400">{log.timestamp}</span>: {log.message}
		</div>
	);
}
