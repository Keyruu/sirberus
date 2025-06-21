import { LogsControls } from '@/components/container/logs/LogsControls';
import { LogsDisplay } from '@/components/container/logs/LogsDisplay';
import { LogsError } from '@/components/container/logs/LogsError';
import { LogsHeader } from '@/components/container/logs/LogsHeader';
import { useContainer } from '@/hooks/use-container';
import { useContainerLogs } from '@/hooks/use-container-logs';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

export function ContainerLogsPage() {
	const { containerId } = useParams();
	const navigate = useNavigate();
	const [numLines, setNumLines] = useState('100');
	const [filterText, setFilterText] = useState('');
	const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
	const { container } = useContainer(containerId || '');
	const { logs, status, controls } = useContainerLogs(containerId || '', numLines);

	// Filter logs based on filterText
	const filteredLogs = useMemo(
		() => (filterText ? logs.filter(log => log.message.toLowerCase().includes(filterText.toLowerCase())) : logs),
		[logs, filterText]
	);

	if (!containerId || !container) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-2">Container not found</h1>
					<p className="text-muted-foreground">The container you're looking for doesn't exist.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-4">
			<LogsHeader container={container} isLoading={false} onNavigateBack={() => navigate('/container')} />

			<LogsControls
				numLines={numLines}
				onNumLinesChange={setNumLines}
				isStreaming={status.isStreaming}
				onToggleStreaming={status.isStreaming ? controls.stopStreaming : controls.startStreaming}
				onRefresh={controls.clearAndRefresh}
				onDownload={controls.downloadLogs}
				filterText={filterText}
				onFilterTextChange={setFilterText}
				isAutoScrollEnabled={isAutoScrollEnabled}
				onAutoScrollChange={setIsAutoScrollEnabled}
			/>

			{status.error && <LogsError error={status.error} />}

			<LogsDisplay
				logs={filteredLogs}
				isLoading={false}
				isStreaming={status.isStreaming}
				isAutoScrollEnabled={isAutoScrollEnabled}
			/>

			<div className="text-sm text-muted-foreground">
				{filteredLogs.length} log entries {filterText && `(filtered from ${logs.length})`}
			</div>
		</div>
	);
}
