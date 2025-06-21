import { BaseLogsDisplay, type LogEntry } from '@/components/shared/logs/BaseLogsDisplay';

interface LogsDisplayProps {
	logs: LogEntry[];
	isLoading?: boolean;
	isStreaming?: boolean;
	isAutoScrollEnabled?: boolean;
}

export function LogsDisplay({ logs, isLoading, isStreaming, isAutoScrollEnabled }: LogsDisplayProps) {
	return (
		<BaseLogsDisplay
			logs={logs}
			isLoading={isLoading}
			isStreaming={isStreaming}
			isAutoScrollEnabled={isAutoScrollEnabled}
		/>
	);
}
