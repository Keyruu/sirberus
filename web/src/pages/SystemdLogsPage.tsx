import { LogsControls } from '@/components/systemd/logs/LogsControls';
import { LogsDisplay } from '@/components/systemd/logs/LogsDisplay';
import { LogsError } from '@/components/systemd/logs/LogsError';
import { LogsHeader } from '@/components/systemd/logs/LogsHeader';
import { useSystemdLogs } from '@/hooks/use-systemd-logs';
import { useSystemdService } from '@/hooks/use-systemd-service';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function SystemdLogsPage() {
	const { serviceName } = useParams<{ serviceName: string }>();
	const navigate = useNavigate();
	const [numLines, setNumLines] = useState('100');
	const [filterText, setFilterText] = useState('');
	const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

	// Use our custom hooks
	const {
		logs,
		status: { isStreaming, error },
		controls,
	} = useSystemdLogs(serviceName || '', numLines);

	const { data: serviceData, isLoading: isLoadingService } = useSystemdService(serviceName || '');

	const service = serviceData?.service;

	// Filter logs based on filterText
	const filteredLogs = useMemo(
		() => (filterText ? logs.filter(log => log.message.toLowerCase().includes(filterText.toLowerCase())) : logs),
		[logs, filterText]
	);

	return (
		<div className="p-6 space-y-4">
			<LogsHeader
				serviceName={serviceName || ''}
				service={service}
				isLoading={isLoadingService}
				onNavigateBack={() => navigate('/systemd')}
			/>

			<LogsControls
				numLines={numLines}
				onNumLinesChange={setNumLines}
				isStreaming={isStreaming}
				onToggleStreaming={isStreaming ? controls.stopStreaming : controls.startStreaming}
				onRefresh={controls.clearAndRefresh}
				onDownload={controls.downloadLogs}
				filterText={filterText}
				onFilterTextChange={setFilterText}
				isAutoScrollEnabled={isAutoScrollEnabled}
				onAutoScrollChange={setIsAutoScrollEnabled}
			/>

			{error && <LogsError error={error} />}

			<LogsDisplay
				logs={filteredLogs}
				isLoading={isLoadingService}
				isStreaming={isStreaming}
				isAutoScrollEnabled={isAutoScrollEnabled}
			/>

			<div className="text-sm text-muted-foreground">
				{filteredLogs.length} log entries {filterText && `(filtered from ${logs.length})`}
			</div>
		</div>
	);
}
