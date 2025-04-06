import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Square } from 'lucide-react';

export interface BulkActionBarProps {
	selectedCount: number;
	onBulkStart: () => void;
	onBulkStop: () => void;
	onBulkRestart: () => void;
	itemName?: string;
}

export function BulkActionBar({
	selectedCount,
	onBulkStart,
	onBulkStop,
	onBulkRestart,
	itemName = 'item',
}: BulkActionBarProps) {
	if (selectedCount === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm font-medium">
				{selectedCount} {itemName}
				{selectedCount !== 1 ? 's' : ''} selected
			</span>
			<Button size="sm" variant="outline" onClick={onBulkStart}>
				<Play className="h-4 w-4 mr-2" />
				Start
			</Button>
			<Button size="sm" variant="outline" onClick={onBulkStop}>
				<Square className="h-4 w-4 mr-2" />
				Stop
			</Button>
			<Button size="sm" variant="outline" onClick={onBulkRestart}>
				<RotateCcw className="h-4 w-4 mr-2" />
				Restart
			</Button>
		</div>
	);
}
