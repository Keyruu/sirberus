import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from 'lucide-react';
import { ServiceMetricsCharts } from './ServiceMetricsCharts';

interface ServiceChartsSectionProps {
	cpuChartData: { index: number; cpu: number }[];
	memoryChartData: { index: number; memory: number }[];
	isRunning: boolean;
}

export function ServiceChartsSection({ cpuChartData, memoryChartData, isRunning }: ServiceChartsSectionProps) {
	const hasChartData = cpuChartData.length > 1 || memoryChartData.length > 1;

	if (!isRunning || !hasChartData) {
		return null;
	}

	return (
		<Card className="md:col-span-2">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center">
					<LineChart className="mr-2 h-5 w-5" />
					Usage Charts
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ServiceMetricsCharts cpuChartData={cpuChartData} memoryChartData={memoryChartData} />
			</CardContent>
		</Card>
	);
}
