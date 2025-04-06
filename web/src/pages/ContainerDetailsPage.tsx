import { ContainerStatusBadge } from '@/components/container/ContainerStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useContainer } from '@/hooks/use-container';
import { useContainerActions } from '@/hooks/use-container-actions';
import { formatBytes } from '@/lib/utils';
import { Play, RotateCcw, Square } from 'lucide-react';
import { Link, useParams } from 'react-router';

export function ContainerDetailsPage() {
	const { containerId } = useParams();
	const { container, isLoading, refetch } = useContainer(containerId || '');
	const { startContainer, stopContainer, restartContainer } = useContainerActions();

	if (!containerId) return null;

	const handleStart = () => startContainer(containerId, refetch);
	const handleStop = () => stopContainer(containerId, refetch);
	const handleRestart = () => restartContainer(containerId, refetch);

	if (isLoading) {
		return (
			<div className="p-6">
				<div className="animate-pulse">
					<div className="h-8 w-64 bg-muted rounded mb-4" />
					<div className="grid gap-6">
						<div className="h-48 bg-muted rounded" />
						<div className="h-48 bg-muted rounded" />
					</div>
				</div>
			</div>
		);
	}

	if (!container) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-2">Container not found</h1>
					<p className="text-muted-foreground mb-4">The container you're looking for doesn't exist.</p>
					<Link to="/container">
						<Button variant="outline">Back to Containers</Button>
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold">{container.name}</h1>
					<p className="text-muted-foreground">{container.id}</p>
				</div>
				<div className="flex items-center gap-2">
					{container.isRunning ? (
						<>
							<Button variant="outline" onClick={handleStop}>
								<Square className="h-4 w-4 mr-2" />
								Stop
							</Button>
							<Button variant="outline" onClick={handleRestart}>
								<RotateCcw className="h-4 w-4 mr-2" />
								Restart
							</Button>
						</>
					) : (
						<Button variant="outline" onClick={handleStart}>
							<Play className="h-4 w-4 mr-2" />
							Start
						</Button>
					)}
					<Link to={`/container/${containerId}/logs`}>
						<Button variant="outline">View Logs</Button>
					</Link>
				</div>
			</div>

			{/* Container Info */}
			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Container Information</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Status</p>
								<ContainerStatusBadge container={container} />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Image</p>
								<p>{container.image}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Created</p>
								<p>{container.created ? new Date(container.created).toLocaleString() : '-'}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Command</p>
								<p className="font-mono text-sm">{container.command || '-'}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Resource Usage */}
				{container.isRunning && (
					<Card>
						<CardHeader>
							<CardTitle>Resource Usage</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
									<p>{container.memoryUsage ? formatBytes(container.memoryUsage) : '-'}</p>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">CPU Usage</p>
									<p>{container.cpuUsage ? `${container.cpuUsage.toFixed(2)}%` : '-'}</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Network Info */}
				<Card>
					<CardHeader>
						<CardTitle>Network Information</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div>
							<p className="text-sm font-medium text-muted-foreground">Ports</p>
							<p>{container.ports || '-'}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">Networks</p>
							<p>{container.networks ? Object.keys(container.networks).join(', ') : '-'}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
