import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Pause, Play, RefreshCw } from 'lucide-react';

interface LogsControlsProps {
	numLines: string;
	onNumLinesChange: (value: string) => void;
	isStreaming: boolean;
	onToggleStreaming: () => void;
	onRefresh: () => void;
	onDownload: () => void;
	filterText: string;
	onFilterTextChange: (value: string) => void;
	isAutoScrollEnabled: boolean;
	onAutoScrollChange: (value: boolean) => void;
}

export function LogsControls({
	numLines,
	onNumLinesChange,
	isStreaming,
	onToggleStreaming,
	onRefresh,
	onDownload,
	filterText,
	onFilterTextChange,
	isAutoScrollEnabled,
	onAutoScrollChange,
}: LogsControlsProps) {
	return (
		<div className="flex items-center space-x-4">
			<div className="flex-1">
				<Input
					placeholder="Filter logs..."
					value={filterText}
					onChange={e => onFilterTextChange(e.target.value)}
					className="w-full"
				/>
			</div>

			<div className="flex items-center space-x-2">
				<Checkbox
					id="auto-scroll"
					checked={isAutoScrollEnabled}
					onCheckedChange={checked => onAutoScrollChange(checked as boolean)}
				/>
				<Label htmlFor="auto-scroll">Auto-scroll</Label>
			</div>

			<div className="flex items-center space-x-2">
				<Select value={numLines} onValueChange={onNumLinesChange}>
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
					onClick={onToggleStreaming}
					title={isStreaming ? 'Pause streaming' : 'Resume streaming'}
				>
					{isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
				</Button>
				<Button variant="outline" size="icon" onClick={onRefresh} title="Refresh logs">
					<RefreshCw className="h-4 w-4" />
				</Button>
				<Button variant="outline" size="icon" onClick={onDownload} title="Download logs">
					<Download className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
