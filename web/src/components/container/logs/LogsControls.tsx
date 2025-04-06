import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Play, Square } from 'lucide-react';

interface LogsControlsProps {
	isStreaming: boolean;
	numLines: string;
	onNumLinesChange: (value: string) => void;
	onStartStreaming: () => void;
	onStopStreaming: () => void;
	onClearLogs: () => void;
	onDownloadLogs: () => void;
}

export function LogsControls({
	isStreaming,
	numLines,
	onNumLinesChange,
	onStartStreaming,
	onStopStreaming,
	onClearLogs,
	onDownloadLogs,
}: LogsControlsProps) {
	return (
		<div className="flex items-center gap-4 mb-4">
			<div className="flex items-center gap-2">
				{isStreaming ? (
					<Button variant="outline" onClick={onStopStreaming}>
						<Square className="h-4 w-4 mr-2" />
						Stop
					</Button>
				) : (
					<Button variant="outline" onClick={onStartStreaming}>
						<Play className="h-4 w-4 mr-2" />
						Start
					</Button>
				)}
				<Button variant="outline" onClick={onClearLogs}>
					Clear
				</Button>
				<Button variant="outline" onClick={onDownloadLogs}>
					<Download className="h-4 w-4 mr-2" />
					Download
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<Input
					type="number"
					value={numLines}
					onChange={e => onNumLinesChange(e.target.value)}
					className="w-24"
					min="1"
					max="10000"
				/>
				<span className="text-sm text-muted-foreground">lines</span>
			</div>
		</div>
	);
}
