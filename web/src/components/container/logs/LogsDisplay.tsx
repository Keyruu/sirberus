import { BaseLogsDisplay, type LogEntry } from '@/components/shared/logs/BaseLogsDisplay';

interface LogsDisplayProps {
	logs: LogEntry[];
}

export function LogsDisplay({ logs }: LogsDisplayProps) {
	return <BaseLogsDisplay logs={logs} height="h-[600px]" className="bg-muted text-muted-foreground" />;
}
