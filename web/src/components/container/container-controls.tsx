import { Button } from '@/components/ui/button';
import { Container } from '@/generated/model';
import { useContainerActions } from '@/hooks/use-container-actions';
import { FileText, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

interface ContainerControlsProps {
	containerId: string;
	container?: Container;
	isRefreshing?: boolean;
	onRefresh?: () => Promise<void>;
	showViewLogs?: boolean;
}

export function ContainerControls({
	containerId,
	container,
	isRefreshing = false,
	onRefresh,
	showViewLogs = true,
}: ContainerControlsProps) {
	const navigate = useNavigate();

	// Use the unified container actions hook
	const { startContainer, stopContainer, restartContainer } = useContainerActions();

	// Handle container actions
	const handleViewLogs = useCallback(() => {
		if (!containerId) return;
		navigate(`/container/${containerId}/logs`);
	}, [navigate, containerId]);

	if (!container) return null;

	const isRunning = container.status?.running || false;

	return (
		<div className="flex items-center space-x-2">
			{showViewLogs && (
				<Button variant="outline" onClick={handleViewLogs}>
					<FileText className="mr-2 h-4 w-4" />
					View Logs
				</Button>
			)}

			{!isRunning ? (
				<Button variant="outline" onClick={() => startContainer(containerId, onRefresh)}>
					<Play className="mr-2 h-4 w-4" />
					Start
				</Button>
			) : (
				<>
					<Button variant="outline" onClick={() => stopContainer(containerId, onRefresh)}>
						<Square className="mr-2 h-4 w-4" />
						Stop
					</Button>
					<Button variant="outline" onClick={() => restartContainer(containerId, onRefresh)}>
						<RotateCcw className="mr-2 h-4 w-4" />
						Restart
					</Button>
				</>
			)}

			{onRefresh && (
				<Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing}>
					<RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
				</Button>
			)}
		</div>
	);
}
