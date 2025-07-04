import { BulkActionBar as SharedBulkActionBar } from '@/components/shared/actions/BulkActionBar';

interface BulkActionBarProps {
	selectedCount: number;
	onBulkStart: () => void;
	onBulkStop: () => void;
	onBulkRestart: () => void;
}

export function BulkActionBar(props: BulkActionBarProps) {
	return <SharedBulkActionBar {...props} itemName="service" />;
}
