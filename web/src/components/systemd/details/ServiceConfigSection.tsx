import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SystemdServiceDetails } from '@/generated/model';
import { Settings } from 'lucide-react';
import { DetailItem } from './DetailItem';

interface ServiceConfigSectionProps {
	serviceDetails?: SystemdServiceDetails;
}

export function ServiceConfigSection({ serviceDetails }: ServiceConfigSectionProps) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center">
					<Settings className="mr-2 h-5 w-5" />
					Configuration
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-1">
					<DetailItem
						label="Fragment Path"
						value={<span className="text-xs font-mono break-all">{serviceDetails?.fragmentPath || '-'}</span>}
					/>
					<DetailItem
						label="Drop-In Paths"
						value={
							serviceDetails?.dropIn && serviceDetails.dropIn.length > 0 ? (
								<div className="text-xs font-mono break-all">
									{serviceDetails.dropIn.map((path, index) => (
										<div key={index}>{path}</div>
									))}
								</div>
							) : (
								'-'
							)
						}
					/>
					<DetailItem
						label="Documentation"
						value={
							serviceDetails?.docs && serviceDetails.docs.length > 0 ? (
								<div className="text-xs break-all">
									{serviceDetails.docs.map((doc, index) => (
										<div key={index}>{doc}</div>
									))}
								</div>
							) : (
								'-'
							)
						}
					/>
					<DetailItem
						label="Triggered By"
						value={
							serviceDetails?.triggeredBy && serviceDetails.triggeredBy.length > 0 ? (
								<div className="text-xs font-mono break-all">
									{serviceDetails.triggeredBy.map((trigger, index) => (
										<div key={index}>{trigger}</div>
									))}
								</div>
							) : (
								'-'
							)
						}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
