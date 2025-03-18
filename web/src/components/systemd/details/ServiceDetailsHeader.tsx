import { ServiceControls } from '@/components/systemd/service-controls';
import { ServiceStatusBadge } from '@/components/systemd/services/ServiceStatusBadge';
import { Button } from '@/components/ui/button';
import { SystemdService } from '@/generated/model';
import { ArrowLeft } from 'lucide-react';

interface ServiceDetailsHeaderProps {
	serviceName: string;
	service?: SystemdService;
	isLoading: boolean;
	isRefreshing: boolean;
	onNavigateBack: () => void;
	onRefresh: () => Promise<void>;
}

export function ServiceDetailsHeader({
	serviceName,
	service,
	isLoading,
	isRefreshing,
	onNavigateBack,
	onRefresh,
}: ServiceDetailsHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center space-x-2">
				<Button variant="outline" size="icon" onClick={onNavigateBack}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">{serviceName}</h1>
				{!isLoading && service && <ServiceStatusBadge service={service} />}
			</div>
			<div className="flex items-center space-x-2">
				{!isLoading && service && (
					<ServiceControls
						serviceName={serviceName}
						service={service}
						isRefreshing={isRefreshing}
						onRefresh={onRefresh}
						showViewLogs={true}
					/>
				)}
			</div>
		</div>
	);
}
