import { ContainerStatusBadge } from '@/components/container/ContainerStatusBadge';
import { ContainerControls } from '@/components/container/container-controls';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/generated/model';
import { ArrowLeft } from 'lucide-react';

interface LogsHeaderProps {
	container: Container;
	isLoading?: boolean;
	onNavigateBack?: () => void;
}

export function LogsHeader({ container, isLoading, onNavigateBack }: LogsHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center space-x-2">
				{onNavigateBack && (
					<Button variant="outline" size="icon" onClick={onNavigateBack}>
						<ArrowLeft className="h-4 w-4" />
					</Button>
				)}
				<h1 className="text-2xl font-bold">{container.name} Logs</h1>
				{!isLoading && container && (
					<>
						<ContainerStatusBadge container={container} />
						<div className="ml-4">
							<ContainerControls containerId={container.id || ''} container={container} showViewLogs={false} />
						</div>
					</>
				)}
				{isLoading && <Skeleton className="h-8 w-20 ml-2" />}
			</div>
		</div>
	);
}
