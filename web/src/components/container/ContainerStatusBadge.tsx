import { Badge } from '@/components/ui/badge';
import { Container } from '@/generated/model';
import { Activity, AlertCircle, CheckCircle, Clock, Pause, RotateCcw, Square, Trash2 } from 'lucide-react';

interface ContainerStatusBadgeProps {
	container: Container;
}

export function ContainerStatusBadge({ container }: ContainerStatusBadgeProps) {
	const status = container.status;
	const state = status?.state?.toLowerCase() || '';

	const statusElement = (() => {
		if (status?.running) {
			return (
				<Badge className="bg-green-500">
					<CheckCircle className="mr-1 h-3 w-3" /> Running
				</Badge>
			);
		}

		if (state === 'exited') {
			return (
				<Badge className="bg-red-500">
					<Square className="mr-1 h-3 w-3" /> Exited
				</Badge>
			);
		}

		if (state === 'created') {
			return (
				<Badge className="bg-gray-500">
					<Clock className="mr-1 h-3 w-3" /> Created
				</Badge>
			);
		}

		if (state === 'paused') {
			return (
				<Badge className="bg-gray-500">
					<Pause className="mr-1 h-3 w-3" /> Paused
				</Badge>
			);
		}

		if (state === 'restarting') {
			return (
				<Badge className="bg-green-500">
					<RotateCcw className="mr-1 h-3 w-3" /> Restarting
				</Badge>
			);
		}

		if (state === 'removing') {
			return (
				<Badge className="bg-gray-500">
					<Trash2 className="mr-1 h-3 w-3" /> Removing
				</Badge>
			);
		}

		if (state === 'dead') {
			return (
				<Badge className="bg-red-500">
					<AlertCircle className="mr-1 h-3 w-3" /> Dead
				</Badge>
			);
		}

		return (
			<Badge className="bg-gray-500">
				<Activity className="mr-1 h-3 w-3" /> {status?.state || 'Unknown'}
			</Badge>
		);
	})();

	// Extract additional status details
	const statusDetails = (() => {
		if (state === 'exited' && status?.exitCode !== undefined) {
			return `Exit Code: ${status.exitCode}`;
		}
		if (status?.error) {
			return `Error: ${status.error}`;
		}
		if (status?.oomKilled) {
			return 'OOM Killed';
		}
		return null;
	})();

	return (
		<div>
			{statusElement}
			{statusDetails && <span className="ml-2 text-xs text-muted-foreground">{statusDetails}</span>}
		</div>
	);
}
