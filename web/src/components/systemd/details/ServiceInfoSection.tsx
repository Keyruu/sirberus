import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SystemdServiceDetails } from '@/generated/model';
import { formatDuration } from '@/lib/utils';
import { Server } from 'lucide-react';
import { DetailItem } from './DetailItem';

interface ServiceInfoSectionProps {
	service?: SystemdServiceDetails['service'];
	since?: string;
}

export function ServiceInfoSection({ service, since }: ServiceInfoSectionProps) {
	return (
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
					<DetailItem label="Since" value={since || '-'} />
				</div>
			</CardContent>
		</Card>
	);
}
