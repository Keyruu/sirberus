import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Square } from 'lucide-react';

interface BulkActionBarProps {
	selectedCount: number;
	onBulkStart: () => void;
	onBulkStop: () => void;
	onBulkRestart: () => void;
}

export function BulkActionBar({ selectedCount, onBulkStart, onBulkStop, onBulkRestart }: BulkActionBarProps) {
	if (selectedCount === 0) {
		return null;
	}

	return (
		<div className="flex items-center space-x-2 py-2">
			<span className="text-sm font-medium">{selectedCount} services selected</span>
			<Button variant="outline" size="sm" onClick={onBulkStart}>
				<Play className="mr-2 h-4 w-4" />
				Start
			</Button>
			<Button variant="outline" size="sm" onClick={onBulkStop}>
				<Square className="mr-2 h-4 w-4" />
				Stop
			</Button>
			<Button variant="outline" size="sm" onClick={onBulkRestart}>
				<RotateCcw className="mr-2 h-4 w-4" />
				Restart
			</Button>
		</div>
	);
}
