import { BulkActionBar as SharedBulkActionBar } from '@/components/shared/actions/BulkActionBar';

interface ContainerBulkActionBarProps {
	selectedCount: number;
	onBulkStart: () => void;
	onBulkStop: () => void;
	onBulkRestart: () => void;
}

export function ContainerBulkActionBar(props: ContainerBulkActionBarProps) {
	return <SharedBulkActionBar {...props} itemName="container" />;
}
