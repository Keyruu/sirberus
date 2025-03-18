import { Button } from '@/components/ui/button';
import { SystemdService } from '@/generated/model';
import { useSystemdActions } from '@/hooks/use-systemd-actions';
import { isServiceRunning } from '@/lib/utils';
import { FileText, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

interface ServiceControlsProps {
	serviceName: string;
	service?: SystemdService;
	isRefreshing?: boolean;
	onRefresh?: () => Promise<void>;
	showViewLogs?: boolean;
}

export function ServiceControls({
	serviceName,
	service,
	isRefreshing = false,
	onRefresh,
	showViewLogs = true,
}: ServiceControlsProps) {
	const navigate = useNavigate();

	// Use the unified systemd actions hook
	const { startService, stopService, restartService } = useSystemdActions();

	// Handle service actions
	const handleViewLogs = useCallback(() => {
		if (!serviceName) return;
		navigate(`/systemd/${serviceName}/logs`);
	}, [navigate, serviceName]);

	if (!service) return null;

	return (
		<div className="flex items-center space-x-2">
			{showViewLogs && (
				<Button variant="outline" onClick={handleViewLogs}>
					<FileText className="mr-2 h-4 w-4" />
					View Logs
				</Button>
			)}

			{!isServiceRunning(service) ? (
				<Button variant="outline" onClick={() => startService(serviceName, onRefresh)}>
					<Play className="mr-2 h-4 w-4" />
					Start
				</Button>
			) : (
				<>
					<Button variant="outline" onClick={() => stopService(serviceName, onRefresh)}>
						<Square className="mr-2 h-4 w-4" />
						Stop
					</Button>
					<Button variant="outline" onClick={() => restartService(serviceName, onRefresh)}>
						<RotateCcw className="mr-2 h-4 w-4" />
						Restart
					</Button>
				</>
			)}

			{onRefresh && (
				<Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing}>
					<RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
				</Button>
			)}
		</div>
	);
}
