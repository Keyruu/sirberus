import { useGetContainer } from '@/generated/containers/containers';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

type StatusFilter = 'running' | 'exited' | 'created' | null;

interface UseContainerListOptions {
	refetchInterval?: number;
	enableRefetch?: boolean;
}

export function useContainerList(options: UseContainerListOptions = {}) {
	const { refetchInterval = 10000, enableRefetch = true } = options;
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

	// Fetch container list
	const { data, isLoading, error, refetch } = useGetContainer({
		query: {
			refetchInterval: enableRefetch ? refetchInterval : undefined,
			queryKey: ['container-list'],
			retry: 3,
			retryDelay: 1000,
			refetchOnWindowFocus: false,
		},
		axios: {
			timeout: 30000,
		},
	});

	// Handle manual refresh
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			toast.error('Failed to refresh containers', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setTimeout(() => {
				setIsRefreshing(false);
			}, 100);
		}
	}, [refetch]);

	// Memoize containers and count
	const containers = useMemo(() => data?.data?.containers || [], [data?.data?.containers]);
	const count = useMemo(() => data?.data?.count || 0, [data?.data?.count]);

	// Calculate status counts
	const statusCounts = useMemo(() => {
		return {
			running: containers.filter(c => c.status?.running).length,
			exited: containers.filter(c => c.status?.state === 'exited').length,
			created: containers.filter(c => c.status?.state === 'created').length,
		};
	}, [containers]);

	// Apply filters
	const filteredContainers = useMemo(() => {
		let result = [...containers];

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				container =>
					(container.name && container.name.toLowerCase().includes(query)) ||
					(container.image && container.image.toLowerCase().includes(query))
			);
		}

		// Apply status filter
		if (statusFilter) {
			if (statusFilter === 'running') {
				result = result.filter(container => container.status?.running);
			} else if (statusFilter === 'exited') {
				result = result.filter(container => container.status?.state === 'exited');
			} else if (statusFilter === 'created') {
				result = result.filter(container => container.status?.state === 'created');
			}
		}

		return result;
	}, [containers, searchQuery, statusFilter]);

	return {
		containers,
		filteredContainers,
		count,
		isLoading,
		error,
		refetch: handleRefresh,
		isRefreshing,
		searchQuery,
		setSearchQuery,
		statusFilter,
		setStatusFilter,
		statusCounts,
	};
}
