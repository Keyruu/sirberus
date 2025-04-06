import {
	usePostContainerIdRestart,
	usePostContainerIdStart,
	usePostContainerIdStop,
} from '@/generated/containers/containers';
import { Container } from '@/generated/model';
import { useCallback } from 'react';
import { toast } from 'sonner';

type ContainerAction = 'start' | 'stop' | 'restart';

export function useContainerActions() {
	// Get mutation hooks
	const startContainer = usePostContainerIdStart();
	const stopContainer = usePostContainerIdStop();
	const restartContainer = usePostContainerIdRestart();

	// Centralized action handler
	const executeContainerAction = useCallback(
		async (actionType: ContainerAction, containerId: string, onSuccess?: () => Promise<void>) => {
			if (!containerId) return;

			const actionVerb = actionType === 'start' ? 'Starting' : actionType === 'stop' ? 'Stopping' : 'Restarting';

			const toastId = toast.loading(`${actionVerb} container: ${containerId}`, {
				description: 'Please wait...',
			});

			try {
				// Execute the appropriate action based on type
				if (actionType === 'start') {
					await startContainer.mutateAsync({ id: containerId });
				} else if (actionType === 'stop') {
					await stopContainer.mutateAsync({ id: containerId });
				} else {
					await restartContainer.mutateAsync({ id: containerId });
				}

				// Show success toast
				toast.success(`Container ${actionType}ed: ${containerId}`, {
					id: toastId,
				});

				// Execute optional callback (e.g., refetch data)
				if (onSuccess) await onSuccess();
			} catch (error) {
				console.error(`Failed to ${actionType} container:`, error);
				toast.error(`Failed to ${actionType} container: ${containerId}`, {
					id: toastId,
					description: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
		[startContainer, stopContainer, restartContainer]
	);

	// Specific action handlers
	const handleStartContainer = useCallback(
		(containerId: string, onSuccess?: () => Promise<void>) => {
			return executeContainerAction('start', containerId, onSuccess);
		},
		[executeContainerAction]
	);

	const handleStopContainer = useCallback(
		(containerId: string, onSuccess?: () => Promise<void>) => {
			return executeContainerAction('stop', containerId, onSuccess);
		},
		[executeContainerAction]
	);

	const handleRestartContainer = useCallback(
		(containerId: string, onSuccess?: () => Promise<void>) => {
			return executeContainerAction('restart', containerId, onSuccess);
		},
		[executeContainerAction]
	);

	// Bulk action handler
	const executeBulkAction = useCallback(
		async (actionType: ContainerAction, containers: Container[], onSuccess?: () => Promise<void>) => {
			if (containers.length === 0) {
				toast.warning('No valid containers selected');
				return;
			}

			const actionText = actionType === 'start' ? 'Starting' : actionType === 'stop' ? 'Stopping' : 'Restarting';
			const toastId = toast.loading(`${actionText} ${containers.length} containers...`);
			let successCount = 0;
			let failCount = 0;

			for (const container of containers) {
				try {
					if (container.id) {
						if (actionType === 'start') {
							await startContainer.mutateAsync({ id: container.id });
						} else if (actionType === 'stop') {
							await stopContainer.mutateAsync({ id: container.id });
						} else {
							await restartContainer.mutateAsync({ id: container.id });
						}
						successCount++;
					}
				} catch (error) {
					console.error(`Failed to ${actionType} container ${container.id || 'unknown'}:`, error);
					failCount++;
				}
			}

			if (failCount === 0) {
				toast.success(`Successfully ${actionType}ed ${successCount} containers`, { id: toastId });
			} else if (successCount === 0) {
				toast.error(`Failed to ${actionType} all ${failCount} containers`, { id: toastId });
			} else {
				const actionDone = actionType === 'start' ? 'Started' : actionType === 'stop' ? 'Stopped' : 'Restarted';
				toast.warning(`${actionDone} ${successCount} containers, failed to ${actionType} ${failCount} containers`, {
					id: toastId,
				});
			}

			if (onSuccess) await onSuccess();
		},
		[startContainer, stopContainer, restartContainer]
	);

	return {
		// Individual container actions
		startContainer: handleStartContainer,
		stopContainer: handleStopContainer,
		restartContainer: handleRestartContainer,

		// Bulk container actions
		bulkStartContainers: (containers: Container[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('start', containers, onSuccess),
		bulkStopContainers: (containers: Container[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('stop', containers, onSuccess),
		bulkRestartContainers: (containers: Container[], onSuccess?: () => Promise<void>) =>
			executeBulkAction('restart', containers, onSuccess),

		// Loading states
		isLoading: startContainer.isPending || stopContainer.isPending || restartContainer.isPending,
	};
}
