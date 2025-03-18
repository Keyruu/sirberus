import { SystemdService } from '@/generated/model';
import { useGetSystemd } from '@/generated/systemd/systemd';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

type StatusFilter = 'active:running' | 'active' | 'inactive' | 'failed' | null;

interface UseSystemdServiceListOptions {
	refetchInterval?: number;
	enableRefetch?: boolean;
}

interface UseSystemdServiceListReturn {
	services: SystemdService[];
	filteredServices: SystemdService[];
	count: number;
	isLoading: boolean;
	error: unknown;
	refetch: () => Promise<void>;
	isRefreshing: boolean;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	statusFilter: StatusFilter;
	setStatusFilter: (filter: StatusFilter) => void;
	statusCounts: {
		running: number;
		active: number;
		inactive: number;
		failed: number;
	};
}

/**
 * Custom hook for fetching and managing the systemd service list
 * Provides filtering, sorting, and consistent error handling
 */
export function useSystemdServiceList(options: UseSystemdServiceListOptions = {}): UseSystemdServiceListReturn {
	const { refetchInterval = 10000, enableRefetch = true } = options;
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

	// Fetch service list
	const { data, isLoading, error, refetch } = useGetSystemd({
		query: {
			refetchInterval: enableRefetch ? refetchInterval : undefined,
			queryKey: ['systemd-services'],
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
			toast.error('Failed to refresh services', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			// Reset refreshing state after a short delay
			setTimeout(() => {
				setIsRefreshing(false);
			}, 100);
		}
	}, [refetch]);

	// Memoize services and count to prevent unnecessary recalculations
	const services = useMemo(() => data?.data?.services || [], [data?.data?.services]);
	const count = useMemo(() => data?.data?.count || 0, [data?.data?.count]);

	// Calculate status counts for filters
	const statusCounts = useMemo(() => {
		return {
			running: services.filter(s => s.activeState === 'active' && s.subState === 'running').length,
			active: services.filter(s => s.activeState === 'active' && s.subState !== 'running').length,
			inactive: services.filter(s => s.activeState === 'inactive').length,
			failed: services.filter(s => s.activeState === 'failed').length,
		};
	}, [services]);

	// Apply filters to services
	const filteredServices = useMemo(() => {
		let result = [...services];

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				service =>
					(service.name && service.name.toLowerCase().includes(query)) ||
					(service.description && service.description.toLowerCase().includes(query))
			);
		}

		// Apply status filter
		if (statusFilter) {
			if (statusFilter === 'active:running') {
				result = result.filter(service => service.activeState === 'active' && service.subState === 'running');
			} else {
				result = result.filter(service => service.activeState === statusFilter);
			}
		}

		return result;
	}, [services, searchQuery, statusFilter]);

	return {
		services,
		filteredServices,
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
