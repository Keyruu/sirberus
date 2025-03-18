import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServiceControls } from '@/components/systemd/service-controls';
import { SystemdService } from '@/generated/model';
import { isServiceRunning } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LogsHeaderProps {
	serviceName: string;
	service?: SystemdService;
	isLoading: boolean;
	onNavigateBack: () => void;
}

export function LogsHeader({ serviceName, service, isLoading, onNavigateBack }: LogsHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center space-x-2">
				<Button variant="outline" size="icon" onClick={onNavigateBack}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">{serviceName} Logs</h1>
				{!isLoading && service && (
					<>
						<Badge className={isServiceRunning(service) ? 'bg-green-500' : 'bg-gray-500'}>
							{isServiceRunning(service) ? 'Running' : service.activeState || 'Unknown'}
						</Badge>
						<div className="ml-4">
							<ServiceControls serviceName={serviceName} service={service} showViewLogs={false} />
						</div>
					</>
				)}
				{isLoading && <Skeleton className="h-8 w-20 ml-2" />}
			</div>
		</div>
	);
}
