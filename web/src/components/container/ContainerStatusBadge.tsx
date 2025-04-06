import { Badge } from '@/components/ui/badge';
import { Container } from '@/generated/model';

interface ContainerStatusBadgeProps {
	container: Container;
}

export function ContainerStatusBadge({ container }: ContainerStatusBadgeProps) {
	const status = container.status?.toLowerCase() || '';
	const statusElement = (() => {
		if (container.isRunning) {
			return <Badge variant="default">Running</Badge>;
		}

		if (status.includes('exited')) {
			return <Badge variant="destructive">Exited</Badge>;
		}

		if (status.includes('created')) {
			return <Badge variant="secondary">Created</Badge>;
		}

		return <Badge variant="outline">{container.status || 'Unknown'}</Badge>;
	})();

	// Extract additional status details (e.g., exit code)
	const statusDetails = (() => {
		if (status.includes('exited')) {
			const match = status.match(/exited \((\d+)\)/i);
			if (match) return `Exit Code: ${match[1]}`;
		}
		return status.replace(/^(running|exited|created)/i, '').trim();
	})();

	return (
		<div>
			{statusElement}
			{statusDetails && <span className="ml-2 text-xs text-muted-foreground">{statusDetails}</span>}
		</div>
	);
}
