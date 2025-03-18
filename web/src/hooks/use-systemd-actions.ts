import { SystemdService } from '@/generated/model';
import {
	usePostSystemdNameRestart,
	usePostSystemdNameStart,
	usePostSystemdNameStop,
} from '@/generated/systemd/systemd';
import { useCallback } from 'react';
import { toast } from 'sonner';

type ServiceAction = 'start' | 'stop' | 'restart';

/**
 * Custom hook for managing systemd service actions
 * Centralizes all service control operations with consistent error handling
 */
export function useSystemdActions() {
	// Get the mutation hooks from the generated API
	const startService = usePostSystemdNameStart();
	const stopService = usePostSystemdNameStop();
	const restartService = usePostSystemdNameRestart();

	// Centralized action handler with consistent error handling
	const executeServiceAction = useCallback(
		async (actionType: ServiceAction, serviceName: string, onSuccess?: () => Promise<void>) => {
			if (!serviceName) return;

			const actionVerb = actionType === 'start' ? 'Starting' : actionType === 'stop' ? 'Stopping' : 'Restarting';

			const toastId = toast.loading(`${actionVerb} service: ${serviceName}`, {
				description: 'Please wait...',
			});

			try {
				// Execute the appropriate action based on type
				if (actionType === 'start') {
					await startService.mutateAsync({ name: serviceName });
				} else if (actionType === 'stop') {
					await stopService.mutateAsync({ name: serviceName });
				} else {
					await restartService.mutateAsync({ name: serviceName });
				}

				// Show success toast
				toast.success(`Service ${actionType}ed: ${serviceName}`, {
					id: toastId,
				});

				// Execute optional callback (e.g., refetch data)
				if (onSuccess) await onSuccess();
			} catch (error) {
				console.error(`Failed to ${actionType} service:`, error);
				toast.error(`Failed to ${actionType} service: ${serviceName}`, {
					id: toastId,
					description: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
		[startService, stopService, restartService]
	);

	// Specific action handlers that use the centralized handler
	const handleStartService = useCallback(
		(serviceName: string, onSuccess?: () => Promise<void>) => {
			return executeServiceAction('start', serviceName, onSuccess);
		},
		[executeServiceAction]
	);

	const handleStopService = useCallback(
		(serviceName: string, onSuccess?: () => Promise<void>) => {
			return executeServiceAction('stop', serviceName, onSuccess);
		},
		[executeServiceAction]
	);

	const handleRestartService = useCallback(
		(serviceName: string, onSuccess?: () => Promise<void>) => {
			return executeServiceAction('restart', serviceName, onSuccess);
		},
		[executeServiceAction]
	);

	// Bulk action handler
	const executeBulkAction = useCallback(
		async (actionType: ServiceAction, services: SystemdService[], onSuccess?: () => Promise<void>) => {
			if (services.length === 0) {
				toast.warning('No valid services selected');
				return;
			}

			const toastId = toast.loading(
				`${actionType === 'start' ? 'Starting' : actionType === 'stop' ? 'Stopping' : 'Restarting'} ${services.length} services...`
			);
			let successCount = 0;
			let failCount = 0;

			for (const service of services) {
				try {
					if (service.name) {
						if (actionType === 'start') {
							await startService.mutateAsync({ name: service.name });
						} else if (actionType === 'stop') {
							await stopService.mutateAsync({ name: service.name });
						} else {
							await restartService.mutateAsync({ name: service.name });
						}
						successCount++;
					}
				} catch (error) {
					console.error(`Failed to ${actionType} service ${service.name || 'unknown'}:`, error);
					failCount++;
				}
			}

			if (failCount === 0) {
				toast.success(`Successfully ${actionType}ed ${successCount} services`, { id: toastId });
			} else if (successCount === 0) {
				toast.error(`Failed to ${actionType} all ${failCount} services`, { id: toastId });
			} else {
				toast.warning(
					`${actionType === 'start' ? 'Started' : actionType === 'stop' ? 'Stopped' : 'Restarted'} ${successCount} services, failed to ${actionType} ${failCount} services`,
					{ id: toastId }
				);
			}

			if (onSuccess) await onSuccess();
		},
		[startService, stopService, restartService]
	);

	return {
		// Individual service actions
		startService: handleStartService,
		stopService: handleStopService,
		restartService: handleRestartService,

		// Bulk service actions
		bulkStartServices: (services: SystemdService[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('start', services, onSuccess),
		bulkStopServices: (services: SystemdService[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('stop', services, onSuccess),
		bulkRestartServices: (services: SystemdService[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('restart', services, onSuccess),

		// Loading states
		isLoading: startService.isPending || stopService.isPending || restartService.isPending,
	};
}
