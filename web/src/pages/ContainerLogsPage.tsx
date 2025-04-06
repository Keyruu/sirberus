import { LogsControls } from '@/components/container/logs/LogsControls';
import { LogsDisplay } from '@/components/container/logs/LogsDisplay';
import { LogsError } from '@/components/container/logs/LogsError';
import { LogsHeader } from '@/components/container/logs/LogsHeader';
import { useContainer } from '@/hooks/use-container';
import { useContainerLogs } from '@/hooks/use-container-logs';
import { useState } from 'react';
import { useParams } from 'react-router';

export function ContainerLogsPage() {
	const { containerId } = useParams();
	const [numLines, setNumLines] = useState('100');
	const { container } = useContainer(containerId || '');
	const { logs, status, controls } = useContainerLogs(containerId || '', numLines);

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
		<div className="p-6">
			<LogsHeader container={container} />

			<LogsControls
				isStreaming={status.isStreaming}
				numLines={numLines}
				onNumLinesChange={setNumLines}
				onStartStreaming={controls.startStreaming}
				onStopStreaming={controls.stopStreaming}
				onClearLogs={controls.clearAndRefresh}
				onDownloadLogs={controls.downloadLogs}
			/>

			{status.error ? <LogsError error={status.error} /> : <LogsDisplay logs={logs} />}
		</div>
	);
}
