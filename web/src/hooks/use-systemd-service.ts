import { SystemdServiceDetails } from '@/generated/model';
import { useGetSystemdName } from '@/generated/systemd/systemd';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseSystemdServiceOptions {
	refetchInterval?: number;
	enableRefetch?: boolean;
}

interface UseSystemdServiceReturn {
	data: SystemdServiceDetails | undefined;
	service: SystemdServiceDetails['service'] | undefined;
	isLoading: boolean;
	error: unknown;
	refetch: () => Promise<void>;
	isRefreshing: boolean;
}

/**
 * Custom hook for fetching a single systemd service
 * Provides consistent error handling and refresh functionality
 */
export function useSystemdService(
	serviceName: string,
	options: UseSystemdServiceOptions = {}
): UseSystemdServiceReturn {
	const { refetchInterval = 5000, enableRefetch = true } = options;
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Fetch service details
	const { data, isLoading, error, refetch } = useGetSystemdName(serviceName, {
		query: {
			enabled: !!serviceName,
			refetchInterval: enableRefetch ? refetchInterval : undefined,
			queryKey: [`systemd-service-${serviceName}`],
			retry: 3,
			retryDelay: 1000,
			refetchOnWindowFocus: false,
		},
		axios: {
			timeout: 30000, // 30 seconds timeout
		},
	});

	// Handle manual refresh with UI feedback
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			toast.error('Failed to refresh service details', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			// Reset refreshing state after a short delay
			setTimeout(() => {
				setIsRefreshing(false);
			}, 100);
		}
	}, [refetch]);

	const serviceDetails = data?.data;
	const service = serviceDetails?.service;

	return {
		data: serviceDetails,
		service,
		isLoading,
		error,
		refetch: handleRefresh,
		isRefreshing,
	};
}
