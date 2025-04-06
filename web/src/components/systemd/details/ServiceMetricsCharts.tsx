import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { formatBytes } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ServiceMetricsChartsProps {
	cpuChartData: { index: number; cpu: number }[];
	memoryChartData: { index: number; memory: number }[];
}

export function ServiceMetricsCharts({ cpuChartData, memoryChartData }: ServiceMetricsChartsProps) {
	const hasCpuData = cpuChartData.length > 1;
	const hasMemoryData = memoryChartData.length > 1;
	const hasAnyData = hasCpuData || hasMemoryData;

	if (!hasAnyData) {
		return (
			<div className="text-center text-muted-foreground text-sm py-4 md:col-span-2">
				Collecting data for charts... Please wait.
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
			{/* CPU Usage Chart */}
			{hasCpuData && (
				<div>
					<h3 className="text-sm font-medium mb-2">CPU Usage</h3>
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
							<Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#cpuGradient)" />
						</AreaChart>
					</ChartContainer>
				</div>
			)}

			{/* Memory Usage Chart */}
			{hasMemoryData && (
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
															<span className="font-bold text-foreground">{formatBytes(Number(payload[0].value))}</span>
														</div>
													</div>
												</div>
											);
										}
										return null;
									}}
								/>
								<Area type="monotone" dataKey="memory" stroke="#10b981" fillOpacity={1} fill="url(#memoryGradient)" />
							</AreaChart>
						</ChartContainer>
					</div>
				</div>
			)}
		</div>
	);
}
