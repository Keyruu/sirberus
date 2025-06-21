import { useContainerList } from '@/hooks/use-container-list';
import { useSystemdServiceList } from '@/hooks/use-systemd-service-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Box, Server, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';

export function MetricsDashboard() {
	const { statusCounts: containerCounts, isLoading: containersLoading, count: totalContainers } = useContainerList();
	const { statusCounts: systemdCounts, isLoading: systemdLoading, count: totalServices } = useSystemdServiceList();
	const navigate = useNavigate();

	if (containersLoading || systemdLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16 mb-2" />
							<Skeleton className="h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	const metrics = [
		{
			title: 'Running Containers',
			value: containerCounts.running,
			total: totalContainers,
			icon: Box,
			color: 'text-green-600',
			bgColor: 'bg-green-100',
		},
		{
			title: 'Running Services',
			value: systemdCounts.running,
			total: totalServices,
			icon: Activity,
			color: 'text-blue-600',
			bgColor: 'bg-blue-100',
		},
		{
			title: 'Active Services',
			value: systemdCounts.active,
			total: totalServices,
			icon: Server,
			color: 'text-purple-600',
			bgColor: 'bg-purple-100',
		},
		{
			title: 'Failed Services',
			value: systemdCounts.failed,
			total: totalServices,
			icon: AlertTriangle,
			color: systemdCounts.failed > 0 ? 'text-red-600' : 'text-gray-600',
			bgColor: systemdCounts.failed > 0 ? 'bg-red-100' : 'bg-gray-100',
		},
	];

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
				<p className="text-muted-foreground">Monitor your containers and systemd services at a glance</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{metrics.map(metric => {
					const Icon = metric.icon;
					return (
						<Card key={metric.title}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
								<div className={`p-2 rounded-full ${metric.bgColor}`}>
									<Icon className={`h-4 w-4 ${metric.color}`} />
								</div>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{metric.value}</div>
								<div className="flex items-center space-x-2 text-xs text-muted-foreground">
									<span>of {metric.total} total</span>
									{metric.title === 'Failed Services' && metric.value > 0 && (
										<Badge variant="destructive" className="text-xs">
											Attention needed
										</Badge>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/container')}>
					<CardHeader>
						<CardTitle className="flex items-center space-x-2">
							<Box className="h-5 w-5" />
							<span>Container Status</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between items-center">
							<span className="text-sm">Running</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<span className="font-medium">{containerCounts.running}</span>
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm">Exited</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-gray-500 rounded-full"></div>
								<span className="font-medium">{containerCounts.exited}</span>
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm">Created</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
								<span className="font-medium">{containerCounts.created}</span>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/systemd')}>
					<CardHeader>
						<CardTitle className="flex items-center space-x-2">
							<Server className="h-5 w-5" />
							<span>Service Status</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between items-center">
							<span className="text-sm">Running</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<span className="font-medium">{systemdCounts.running}</span>
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm">Active (Other)</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
								<span className="font-medium">{systemdCounts.active}</span>
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm">Inactive</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-gray-500 rounded-full"></div>
								<span className="font-medium">{systemdCounts.inactive}</span>
							</div>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm">Failed</span>
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-red-500 rounded-full"></div>
								<span className="font-medium">{systemdCounts.failed}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
