import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SystemdServiceDetails } from '@/generated/model';
import { formatBytes } from '@/lib/utils';
import { CpuIcon } from 'lucide-react';
import { DetailItem } from './DetailItem';

interface ServiceMetricsSectionProps {
	service?: SystemdServiceDetails['service'];
	serviceDetails?: SystemdServiceDetails;
}

export function ServiceMetricsSection({ service, serviceDetails }: ServiceMetricsSectionProps) {
	return (
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
					<DetailItem label="Memory Usage" value={service?.memoryUsage ? formatBytes(service.memoryUsage) : '-'} />
					<DetailItem
						label="Memory Peak"
						value={serviceDetails?.memoryPeak ? formatBytes(serviceDetails.memoryPeak) : '-'}
					/>
					<DetailItem
						label="CPU Time"
						value={serviceDetails?.cpuTimeNSec ? `${(serviceDetails.cpuTimeNSec / 1000000000).toFixed(2)}s` : '-'}
					/>
					<DetailItem
						label="Tasks"
						value={serviceDetails?.tasks !== undefined ? serviceDetails.tasks.toString() : '-'}
					/>
					<DetailItem
						label="Tasks Limit"
						value={serviceDetails?.tasksLimit !== undefined ? serviceDetails.tasksLimit.toString() : '-'}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
