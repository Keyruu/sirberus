import { Badge } from '@/components/ui/badge';
import { SystemdService } from '@/generated/model';
import { isServiceRunning } from '@/lib/utils';
import { Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ServiceStatusBadgeProps {
	service: SystemdService;
}

export function ServiceStatusBadge({ service }: ServiceStatusBadgeProps) {
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
				<Activity className="mr-1 h-3 w-3" /> Active
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
