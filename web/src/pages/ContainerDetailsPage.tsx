import { ContainerStatusBadge } from '@/components/container/ContainerStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useContainer } from '@/hooks/use-container';
import { useContainerActions } from '@/hooks/use-container-actions';
import { formatBytes } from '@/lib/utils';
import { FileText, Play, RotateCcw, Square } from 'lucide-react';
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
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="h-48 bg-muted rounded" />
						<div className="h-48 bg-muted rounded" />
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
					{container.status?.running ? (
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
						<Button variant="outline">
							<FileText className="mr-2 h-4 w-4" />
							View Logs
						</Button>
					</Link>
				</div>
			</div>

			{/* Container Info */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Container Information</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Status</p>
								<ContainerStatusBadge container={container} />
								{container.status?.message && (
									<p className="text-xs text-muted-foreground mt-1">{container.status.message}</p>
								)}
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Image</p>
								<p className="font-mono text-sm">{container.image}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Created</p>
								<p>{container.created ? new Date(container.created).toLocaleString() : '-'}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">Size</p>
								<p>{container.size || '-'}</p>
							</div>
							<div className="col-span-2">
								<p className="text-sm font-medium text-muted-foreground">Command</p>
								<p className="font-mono text-sm bg-muted p-2 rounded">{container.command || '-'}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Resource Usage */}
				{container.status?.running && (
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
									<p>{container.cpuUsage !== undefined ? `${(container.cpuUsage / 1e9).toFixed(2)}%` : '-'}</p>
								</div>
								{container.status?.pid && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">Process ID</p>
										<p>{container.status.pid}</p>
									</div>
								)}
								{container.status?.startedAt && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">Started At</p>
										<p>{new Date(container.status.startedAt).toLocaleString()}</p>
									</div>
								)}
								{container.status?.finishedAt && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">Finished At</p>
										<p>{new Date(container.status.finishedAt).toLocaleString()}</p>
									</div>
								)}
								{container.status?.exitCode !== undefined && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">Exit Code</p>
										<p className={container.status.exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
											{container.status.exitCode}
										</p>
									</div>
								)}
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

				{/* Environment Variables */}
				{container.environment && container.environment.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Environment Variables</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{container.environment.map((env, index) => {
									const [key, ...valueParts] = env.split('=');
									const value = valueParts.join('=');
									return (
										<div key={index} className="flex items-center gap-2">
											<Badge variant="outline" className="font-mono text-xs">
												{key}
											</Badge>
											<span className="text-sm font-mono">=</span>
											<span className="text-sm font-mono bg-muted px-2 py-1 rounded">{value || '""'}</span>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Labels */}
				{container.labels && Object.keys(container.labels).length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Labels</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{Object.entries(container.labels).map(([key, value]) => (
									<div key={key} className="flex items-center gap-2">
										<Badge variant="secondary" className="font-mono text-xs">
											{key}
										</Badge>
										<span className="text-sm font-mono">=</span>
										<span className="text-sm font-mono bg-muted px-2 py-1 rounded">{value || '""'}</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Mounts */}
				{container.mounts && container.mounts.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Volume Mounts</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{container.mounts.map((mount, index) => (
									<div key={index} className="border rounded p-3">
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div>
												<p className="font-medium text-muted-foreground">Source</p>
												<p className="font-mono">{mount.source || '-'}</p>
											</div>
											<div>
												<p className="font-medium text-muted-foreground">Destination</p>
												<p className="font-mono">{mount.destination || '-'}</p>
											</div>
											{mount.mode && (
												<div className="col-span-2">
													<p className="font-medium text-muted-foreground">Mode</p>
													<Badge variant="outline">{mount.mode}</Badge>
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
