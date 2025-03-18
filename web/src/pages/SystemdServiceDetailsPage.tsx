import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ServiceControls } from '@/components/systemd/service-controls';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemdServiceDetails } from '@/generated/model';
import { useGetSystemdName } from '@/generated/systemd/systemd';
import { formatBytes, formatDuration, isServiceRunning } from '@/lib/utils';
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle,
	Clock,
	CpuIcon,
	HardDrive,
	LineChart,
	Network,
	Server,
	Settings,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

// Define types for our chart data
interface DataPoint {
	timestamp: number;
	value: number;
}

export default function SystemdServiceDetailsPage() {
	const { serviceName } = useParams<{ serviceName: string }>();
	const navigate = useNavigate();
	const [isRefreshing, setIsRefreshing] = useState(false);

	// State for historical data
	const [cpuHistory, setCpuHistory] = useState<DataPoint[]>([]);
	const [memoryHistory, setMemoryHistory] = useState<DataPoint[]>([]);
	const maxDataPoints = 20; // Maximum number of data points to keep

	// Fetch service details
	const { data, isLoading, error, refetch } = useGetSystemdName(serviceName || '', {
		query: {
			refetchInterval: 5000, // Refresh every 5 seconds
			queryKey: [`systemd-service-${serviceName}`],
			retry: 3,
			retryDelay: 1000,
			refetchOnWindowFocus: false,
		},
		axios: {
			timeout: 30000, // 30 seconds timeout
		},
	});

	// Handle manual refresh with UI feedback
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			toast.error('Failed to refresh service details', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			// Reset refreshing state after a short delay
			setTimeout(() => {
				setIsRefreshing(false);
			}, 100);
		}
	}, [refetch]);

	const serviceDetails = data?.data;
	const service = serviceDetails?.service;

	// Update history when data changes
	useEffect(() => {
		if (service && service.activeState === 'active' && service.subState === 'running') {
			const now = Date.now();

			// Update CPU history if we have valid data
			if (service.cpuUsage !== undefined && service.cpuUsage >= 0) {
				setCpuHistory(prev => {
					const newHistory = [...prev, { timestamp: now, value: service.cpuUsage as number }];
					// Keep only the last maxDataPoints
					return newHistory.slice(-maxDataPoints);
				});
			}

			// Update memory history if we have valid data
			if (service.memoryUsage !== undefined) {
				setMemoryHistory(prev => {
					const newHistory = [...prev, { timestamp: now, value: service.memoryUsage as number }];
					// Keep only the last maxDataPoints
					return newHistory.slice(-maxDataPoints);
				});
			}
		}
	}, [service]);

	// Format data for charts
	const cpuChartData = cpuHistory.map((point, index) => ({
		index,
		cpu: point.value,
	}));

	const memoryChartData = memoryHistory.map((point, index) => ({
		index,
		memory: point.value,
	}));

	// Check if service is running
	const isRunning = service?.activeState === 'active' && service?.subState === 'running';

	function getStatusBadge(service?: SystemdServiceDetails['service']) {
		if (!service) return null;

		if (isServiceRunning(service)) {
			return (
				<Badge className="bg-green-500">
					<CheckCircle className="mr-1 h-3 w-3" /> Running
				</Badge>
			);
		}
		if (service.activeState === 'active') {
			return (
				<Badge className="bg-blue-500">
					<CheckCircle className="mr-1 h-3 w-3" /> Active
				</Badge>
			);
		}
		if (service.activeState === 'inactive') {
			return (
				<Badge className="bg-gray-500">
					<Clock className="mr-1 h-3 w-3" /> Inactive
				</Badge>
			);
		}
		if (service.activeState === 'failed') {
			return (
				<Badge className="bg-red-500">
					<AlertCircle className="mr-1 h-3 w-3" /> Failed
				</Badge>
			);
		}
		return <Badge className="bg-yellow-500">{service.activeState || 'Unknown'}</Badge>;
	}

	// Helper function to render a detail item
	const DetailItem = ({
		label,
		value,
		className = '',
	}: {
		label: string;
		value: React.ReactNode;
		className?: string;
	}) => (
		<div className={`flex justify-between py-2 ${className}`}>
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<Button variant="outline" size="icon" onClick={() => navigate('/systemd')}>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<h1 className="text-2xl font-bold">{serviceName}</h1>
					{!isLoading && service && getStatusBadge(service)}
				</div>
				<div className="flex items-center space-x-2">
					{!isLoading && service && (
						<ServiceControls
							serviceName={serviceName || ''}
							service={service}
							isRefreshing={isRefreshing}
							onRefresh={handleRefresh}
							showViewLogs={true}
						/>
					)}
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-8 w-full" />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-64 w-full" />
					</div>
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						<span>Failed to load service details</span>
						<Button variant="outline" size="sm" onClick={() => handleRefresh()} className="mt-2">
							Try Again
						</Button>
					</AlertTitle>
				</Alert>
			) : serviceDetails ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Basic Information Card */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center">
								<Server className="mr-2 h-5 w-5" />
								Basic Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-1">
								<DetailItem label="Description" value={service?.description || '-'} />
								<DetailItem label="Load State" value={service?.loadState || '-'} />
								<DetailItem label="Active State" value={service?.activeState || '-'} />
								<DetailItem label="Sub State" value={service?.subState || '-'} />
								<DetailItem label="Uptime" value={service?.uptime ? formatDuration(service.uptime) : '-'} />
								<DetailItem label="Since" value={serviceDetails.since || '-'} />
							</div>
						</CardContent>
					</Card>

					{/* Performance Metrics Card */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center">
								<CpuIcon className="mr-2 h-5 w-5" />
								Performance Metrics
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-1">
								<DetailItem
									label="CPU Usage"
									value={
										service?.cpuUsage !== undefined && service.cpuUsage >= 0
											? `${service.cpuUsage.toFixed(2)}%`
											: service?.cpuUsage === -1
												? 'Measuring...'
												: '-'
									}
								/>
								<DetailItem
									label="Memory Usage"
									value={service?.memoryUsage ? formatBytes(service.memoryUsage) : '-'}
								/>
								<DetailItem
									label="Memory Peak"
									value={serviceDetails.memoryPeak ? formatBytes(serviceDetails.memoryPeak) : '-'}
								/>
								<DetailItem
									label="CPU Time"
									value={serviceDetails.cpuTimeNSec ? `${(serviceDetails.cpuTimeNSec / 1000000000).toFixed(2)}s` : '-'}
								/>
								<DetailItem
									label="Tasks"
									value={serviceDetails.tasks !== undefined ? serviceDetails.tasks.toString() : '-'}
								/>
								<DetailItem
									label="Tasks Limit"
									value={serviceDetails.tasksLimit !== undefined ? serviceDetails.tasksLimit.toString() : '-'}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Network & I/O Card */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center">
								<Network className="mr-2 h-5 w-5" />
								Network & I/O
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-1">
								<DetailItem
									label="IP Ingress"
									value={serviceDetails.ipIngressBytes ? formatBytes(serviceDetails.ipIngressBytes) : '-'}
								/>
								<DetailItem
									label="IP Egress"
									value={serviceDetails.ipEgressBytes ? formatBytes(serviceDetails.ipEgressBytes) : '-'}
								/>
								<Separator className="my-2" />
								<DetailItem
									label="IO Read"
									value={serviceDetails.ioReadBytes ? formatBytes(serviceDetails.ioReadBytes) : '-'}
								/>
								<DetailItem
									label="IO Write"
									value={serviceDetails.ioWriteBytes ? formatBytes(serviceDetails.ioWriteBytes) : '-'}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Configuration Card */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center">
								<Settings className="mr-2 h-5 w-5" />
								Configuration
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-1">
								<DetailItem
									label="Fragment Path"
									value={<span className="text-xs font-mono break-all">{serviceDetails.fragmentPath || '-'}</span>}
								/>
								<DetailItem
									label="Drop-In Paths"
									value={
										serviceDetails.dropIn && serviceDetails.dropIn.length > 0 ? (
											<div className="text-xs font-mono break-all">
												{serviceDetails.dropIn.map((path, index) => (
													<div key={index}>{path}</div>
												))}
											</div>
										) : (
											'-'
										)
									}
								/>
								<DetailItem
									label="Documentation"
									value={
										serviceDetails.docs && serviceDetails.docs.length > 0 ? (
											<div className="text-xs break-all">
												{serviceDetails.docs.map((doc, index) => (
													<div key={index}>{doc}</div>
												))}
											</div>
										) : (
											'-'
										)
									}
								/>
								<DetailItem
									label="Triggered By"
									value={
										serviceDetails.triggeredBy && serviceDetails.triggeredBy.length > 0 ? (
											<div className="text-xs font-mono break-all">
												{serviceDetails.triggeredBy.map((trigger, index) => (
													<div key={index}>{trigger}</div>
												))}
											</div>
										) : (
											'-'
										)
									}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Process Information Card */}
					<Card className="md:col-span-2">
						<CardHeader className="pb-2">
							<CardTitle className="flex items-center">
								<HardDrive className="mr-2 h-5 w-5" />
								Process Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-1">
								<DetailItem label="Main PID" value={serviceDetails.mainPID ? serviceDetails.mainPID.toString() : '-'} />
								<DetailItem
									label="Main Process"
									value={<span className="text-xs font-mono break-all">{serviceDetails.mainProcess || '-'}</span>}
								/>
								<DetailItem
									label="CGroup"
									value={<span className="text-xs font-mono break-all">{serviceDetails.cGroup || '-'}</span>}
								/>
								<DetailItem label="Invocation ID" value={serviceDetails.invocation || '-'} />
							</div>
						</CardContent>
					</Card>

					{/* Charts Card */}
					{isRunning && (cpuChartData.length > 1 || memoryChartData.length > 1) && (
						<Card className="md:col-span-2">
							<CardHeader className="pb-2">
								<CardTitle className="flex items-center">
									<LineChart className="mr-2 h-5 w-5" />
									Usage Charts
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									{/* CPU Usage Chart */}
									{cpuChartData.length > 1 && (
										<div>
											<h3 className="text-sm font-medium mb-2">CPU Usage</h3>
											<div className="h-[180px]">
												<ChartContainer
													config={{
														cpu: {
															label: 'CPU',
															color: '#3b82f6',
														},
													}}
												>
													<AreaChart data={cpuChartData}>
														<defs>
															<linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
																<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
																<stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
															</linearGradient>
														</defs>
														<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
														<XAxis dataKey="index" tickFormatter={() => ''} axisLine={false} tickLine={false} />
														<YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} width={40} />
														<ChartTooltip
															content={({ active, payload }) => {
																if (active && payload && payload.length) {
																	return (
																		<div className="rounded-lg border bg-background p-2 shadow-sm">
																			<div className="grid grid-cols-2 gap-2">
																				<div className="flex flex-col">
																					<span className="text-[0.70rem] uppercase text-muted-foreground">CPU</span>
																					<span className="font-bold text-foreground">
																						{typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : 0}%
																					</span>
																				</div>
																			</div>
																		</div>
																	);
																}
																return null;
															}}
														/>
														<Area
															type="monotone"
															dataKey="cpu"
															stroke="#3b82f6"
															fillOpacity={1}
															fill="url(#cpuGradient)"
														/>
													</AreaChart>
												</ChartContainer>
											</div>
										</div>
									)}

									{/* Memory Usage Chart */}
									{memoryChartData.length > 1 && (
										<div>
											<h3 className="text-sm font-medium mb-2">Memory Usage</h3>
											<div className="h-[180px]">
												<ChartContainer
													config={{
														memory: {
															label: 'Memory',
															color: '#10b981',
														},
													}}
												>
													<AreaChart data={memoryChartData}>
														<defs>
															<linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
																<stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
																<stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
															</linearGradient>
														</defs>
														<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
														<XAxis dataKey="index" tickFormatter={() => ''} axisLine={false} tickLine={false} />
														<YAxis tickFormatter={value => formatBytes(Number(value)).split(' ')[0]} width={40} />
														<ChartTooltip
															content={({ active, payload }) => {
																if (active && payload && payload.length) {
																	return (
																		<div className="rounded-lg border bg-background p-2 shadow-sm">
																			<div className="grid grid-cols-2 gap-2">
																				<div className="flex flex-col">
																					<span className="text-[0.70rem] uppercase text-muted-foreground">Memory</span>
																					<span className="font-bold text-foreground">
																						{formatBytes(Number(payload[0].value))}
																					</span>
																				</div>
																			</div>
																		</div>
																	);
																}
																return null;
															}}
														/>
														<Area
															type="monotone"
															dataKey="memory"
															stroke="#10b981"
															fillOpacity={1}
															fill="url(#memoryGradient)"
														/>
													</AreaChart>
												</ChartContainer>
											</div>
										</div>
									)}

									{/* Show message if not enough data points */}
									{(cpuChartData.length <= 1 || memoryChartData.length <= 1) && (
										<div className="text-center text-muted-foreground text-sm py-4 md:col-span-2">
											Collecting data for charts... Please wait.
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			) : null}
		</div>
	);
}
