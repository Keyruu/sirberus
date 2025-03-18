import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SystemdServiceDetails } from '@/generated/model';
import { HardDrive } from 'lucide-react';
import { DetailItem } from './DetailItem';

interface ServiceProcessSectionProps {
	serviceDetails?: SystemdServiceDetails;
}

export function ServiceProcessSection({ serviceDetails }: ServiceProcessSectionProps) {
	return (
		<Card className="md:col-span-2">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center">
					<HardDrive className="mr-2 h-5 w-5" />
					Process Information
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-1">
					<DetailItem label="Main PID" value={serviceDetails?.mainPID ? serviceDetails.mainPID.toString() : '-'} />
					<DetailItem
						label="Main Process"
						value={<span className="text-xs font-mono break-all">{serviceDetails?.mainProcess || '-'}</span>}
					/>
					<DetailItem
						label="CGroup"
						value={<span className="text-xs font-mono break-all">{serviceDetails?.cGroup || '-'}</span>}
					/>
					<DetailItem label="Invocation ID" value={serviceDetails?.invocation || '-'} />
				</div>
			</CardContent>
		</Card>
	);
}
