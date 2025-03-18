import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SystemdService } from '@/generated/model';
import { formatBytes, formatDuration, isServiceRunning } from '@/lib/utils';
import { FileText, Info, MoreHorizontal, Play, RotateCcw, Square } from 'lucide-react';
import { ServiceStatusBadge } from './ServiceStatusBadge';

interface ServiceTableRowProps {
	service: SystemdService;
	isSelected: boolean;
	onToggleSelect: (selected: boolean) => void;
	onViewDetails: () => void;
	onViewLogs: () => void;
	onStartService: () => void;
	onStopService: () => void;
	onRestartService: () => void;
}

export function ServiceTableRow({
	service,
	isSelected,
	onToggleSelect,
	onViewDetails,
	onViewLogs,
	onStartService,
	onStopService,
	onRestartService,
}: ServiceTableRowProps) {
	const isRunning = isServiceRunning(service);

	return (
		<tr className="border-b">
			<td className="p-2">
				<Checkbox checked={isSelected} onCheckedChange={onToggleSelect} aria-label="Select row" />
			</td>
			<td className="p-2">
				<Button
					variant="link"
					className="p-0 h-auto font-medium text-foreground hover:underline hover:cursor-pointer"
					onClick={onViewDetails}
				>
					{service.name}
				</Button>
			</td>
			<td className="p-2">{service.description || '-'}</td>
			<td className="p-2">
				<ServiceStatusBadge service={service} />
				{service.subState && service.subState !== 'running' && (
					<span className="ml-2 text-xs text-muted-foreground">{service.subState}</span>
				)}
			</td>
			<td className="p-2">
				{isRunning ? (service.memoryUsage !== undefined ? formatBytes(service.memoryUsage) : '-') : '-'}
			</td>
			<td className="p-2">
				{isRunning
					? service.cpuUsage !== undefined
						? service.cpuUsage === -1
							? 'Measuring...'
							: `${service.cpuUsage.toFixed(2)}%`
						: '-'
					: '-'}
			</td>
			<td className="p-2">
				{service.uptime !== undefined && service.uptime > 0 ? formatDuration(service.uptime) : '-'}
			</td>
			<td className="p-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center">
							<MoreHorizontal className="h-5 w-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onViewDetails}>
							<Info className="mr-2 h-4 w-4" />
							View Details
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onViewLogs}>
							<FileText className="mr-2 h-4 w-4" />
							View Logs
						</DropdownMenuItem>
						{!isRunning ? (
							<DropdownMenuItem onClick={onStartService}>
								<Play className="mr-2 h-4 w-4" />
								Start
							</DropdownMenuItem>
						) : (
							<>
								<DropdownMenuItem onClick={onStopService}>
									<Square className="mr-2 h-4 w-4" />
									Stop
								</DropdownMenuItem>
								<DropdownMenuItem onClick={onRestartService}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Restart
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}
