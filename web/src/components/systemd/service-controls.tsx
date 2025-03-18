import { Button } from '@/components/ui/button';
import { SystemdService } from '@/generated/model';
import {
	usePostSystemdNameRestart,
	usePostSystemdNameStart,
	usePostSystemdNameStop,
} from '@/generated/systemd/systemd';
import { isServiceRunning } from '@/lib/utils';
import { FileText, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

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

	// Mutations for service actions
	const startService = usePostSystemdNameStart();
	const stopService = usePostSystemdNameStop();
	const restartService = usePostSystemdNameRestart();

	// Handle service actions
	const handleViewLogs = useCallback(() => {
		if (!serviceName) return;
		navigate(`/systemd/${serviceName}/logs`);
	}, [navigate, serviceName]);

	const handleStartService = useCallback(async () => {
		if (!serviceName) return;

		const toastId = toast.loading(`Starting service: ${serviceName}`, {
			description: 'Please wait...',
		});

		try {
			await startService.mutateAsync({ name: serviceName });
			toast.success(`Service started: ${serviceName}`, {
				id: toastId,
			});
			if (onRefresh) await onRefresh();
		} catch (error) {
			console.error('Failed to start service:', error);
			toast.error(`Failed to start service: ${serviceName}`, {
				id: toastId,
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}, [startService, onRefresh, serviceName]);

	const handleStopService = useCallback(async () => {
		if (!serviceName) return;

		const toastId = toast.loading(`Stopping service: ${serviceName}`, {
			description: 'Please wait...',
		});

		try {
			await stopService.mutateAsync({ name: serviceName });
			toast.success(`Service stopped: ${serviceName}`, {
				id: toastId,
			});
			if (onRefresh) await onRefresh();
		} catch (error) {
			console.error('Failed to stop service:', error);
			toast.error(`Failed to stop service: ${serviceName}`, {
				id: toastId,
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}, [stopService, onRefresh, serviceName]);

	const handleRestartService = useCallback(async () => {
		if (!serviceName) return;

		const toastId = toast.loading(`Restarting service: ${serviceName}`, {
			description: 'Please wait...',
		});

		try {
			await restartService.mutateAsync({ name: serviceName });
			toast.success(`Service restarted: ${serviceName}`, {
				id: toastId,
			});
			if (onRefresh) await onRefresh();
		} catch (error) {
			console.error('Failed to restart service:', error);
			toast.error(`Failed to restart service: ${serviceName}`, {
				id: toastId,
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}, [restartService, onRefresh, serviceName]);

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
				<Button variant="outline" onClick={handleStartService}>
					<Play className="mr-2 h-4 w-4" />
					Start
				</Button>
			) : (
				<>
					<Button variant="outline" onClick={handleStopService}>
						<Square className="mr-2 h-4 w-4" />
						Stop
					</Button>
					<Button variant="outline" onClick={handleRestartService}>
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
