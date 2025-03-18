import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SystemdServiceDetails } from '@/generated/model';
import { formatBytes } from '@/lib/utils';
import { Network } from 'lucide-react';
import { DetailItem } from './DetailItem';

interface ServiceNetworkSectionProps {
	serviceDetails?: SystemdServiceDetails;
}

export function ServiceNetworkSection({ serviceDetails }: ServiceNetworkSectionProps) {
	return (
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
						value={serviceDetails?.ipIngressBytes ? formatBytes(serviceDetails.ipIngressBytes) : '-'}
					/>
					<DetailItem
						label="IP Egress"
						value={serviceDetails?.ipEgressBytes ? formatBytes(serviceDetails.ipEgressBytes) : '-'}
					/>
					<Separator className="my-2" />
					<DetailItem
						label="IO Read"
						value={serviceDetails?.ioReadBytes ? formatBytes(serviceDetails.ioReadBytes) : '-'}
					/>
					<DetailItem
						label="IO Write"
						value={serviceDetails?.ioWriteBytes ? formatBytes(serviceDetails.ioWriteBytes) : '-'}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
