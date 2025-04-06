import { useGetContainerId } from '@/generated/containers/containers';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export function useContainer(id: string) {
	const [isRefreshing, setIsRefreshing] = useState(false);

	const { data, isLoading, error, refetch } = useGetContainerId(id, {
		query: {
			refetchInterval: 10000,
			queryKey: ['container-details', id],
			retry: 3,
			retryDelay: 1000,
			refetchOnWindowFocus: false,
		},
		axios: {
			timeout: 30000,
		},
	});

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			toast.error('Failed to refresh container details', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setTimeout(() => {
				setIsRefreshing(false);
			}, 100);
		}
	}, [refetch]);

	return {
		container: data?.data,
		isLoading,
		error,
		refetch: handleRefresh,
		isRefreshing,
	};
}
