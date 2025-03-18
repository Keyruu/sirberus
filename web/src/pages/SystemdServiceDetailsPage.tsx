import { Alert, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceChartsSection } from '@/components/systemd/details/ServiceChartsSection';
import { ServiceConfigSection } from '@/components/systemd/details/ServiceConfigSection';
import { ServiceDetailsHeader } from '@/components/systemd/details/ServiceDetailsHeader';
import { ServiceInfoSection } from '@/components/systemd/details/ServiceInfoSection';
import { ServiceMetricsSection } from '@/components/systemd/details/ServiceMetricsSection';
import { ServiceNetworkSection } from '@/components/systemd/details/ServiceNetworkSection';
import { ServiceProcessSection } from '@/components/systemd/details/ServiceProcessSection';
import { useSystemdService } from '@/hooks/use-systemd-service';
import { useSystemdServiceMetrics } from '@/hooks/use-systemd-service-metrics';
import { AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

export default function SystemdServiceDetailsPage() {
	const { serviceName } = useParams<{ serviceName: string }>();
	const navigate = useNavigate();

	// Use our custom hooks
	const {
		data: serviceDetails,
		service,
		isLoading,
		error,
		refetch,
		isRefreshing,
	} = useSystemdService(serviceName || '');

	const { cpuChartData, memoryChartData } = useSystemdServiceMetrics(service);

	// Check if service is running
	const isRunning = service?.activeState === 'active' && service?.subState === 'running';

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<ServiceDetailsHeader
				serviceName={serviceName || ''}
				service={service}
				isLoading={isLoading}
				isRefreshing={isRefreshing}
				onNavigateBack={() => navigate('/systemd')}
				onRefresh={refetch}
			/>

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
					</AlertTitle>
				</Alert>
			) : serviceDetails ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Basic Information */}
					<ServiceInfoSection service={service} since={serviceDetails.since} />

					{/* Performance Metrics */}
					<ServiceMetricsSection service={service} serviceDetails={serviceDetails} />

					{/* Network & I/O */}
					<ServiceNetworkSection serviceDetails={serviceDetails} />

					{/* Configuration */}
					<ServiceConfigSection serviceDetails={serviceDetails} />

					{/* Process Information */}
					<ServiceProcessSection serviceDetails={serviceDetails} />

					{/* Charts */}
					<ServiceChartsSection cpuChartData={cpuChartData} memoryChartData={memoryChartData} isRunning={isRunning} />
				</div>
			) : null}
		</div>
	);
}
