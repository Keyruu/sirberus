import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DataTableToolbar } from '@/components/ui/data-table-toolbar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemdService } from '@/generated/model';
import {
	useGetSystemd,
	usePostSystemdNameRestart,
	usePostSystemdNameStart,
	usePostSystemdNameStop,
} from '@/generated/systemd/systemd';
import { formatBytes, formatDuration, isServiceRunning } from '@/lib/utils';
import { ColumnDef, Row } from '@tanstack/react-table';
import {
	Activity,
	AlertCircle,
	CheckCircle,
	Clock,
	FileText,
	Info,
	MoreHorizontal,
	Play,
	RotateCcw,
	Square,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

export default function SystemdPage() {
	const [isRefreshing, setIsRefreshing] = useState(false);

	const { data, isLoading, error, refetch } = useGetSystemd({
		query: {
			refetchInterval: 10000, // Refresh every 10 seconds
			queryKey: ['systemd-services'],
			retry: 3,
			retryDelay: 1000,
			// Don't refetch on window focus to prevent cancellation issues
			refetchOnWindowFocus: false,
		},
		// Configure axios to handle cancellations better
		axios: {
			timeout: 30000, // 30 seconds timeout
		},
	});

	// Mutations for service actions
	const startService = usePostSystemdNameStart();
	const stopService = usePostSystemdNameStop();
	const restartService = usePostSystemdNameRestart();

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

	const services = data?.data?.services || [];
	const count = data?.data?.count || 0;

	// Handle service actions
	const navigate = useNavigate();

	const handleViewLogs = useCallback(
		(service: SystemdService) => {
			if (!service.name) return;
			navigate(`/systemd/${service.name}/logs`);
		},
		[navigate]
	);

	const handleViewDetails = useCallback(
		(service: SystemdService) => {
			if (!service.name) return;
			navigate(`/systemd/${service.name}`);
		},
		[navigate]
	);

	const handleStartService = useCallback(
		async (service: SystemdService) => {
			if (!service.name) return;

			const toastId = toast.loading(`Starting service: ${service.name}`, {
				description: 'Please wait...',
			});

			try {
				await startService.mutateAsync({ name: service.name });
				toast.success(`Service started: ${service.name}`, {
					id: toastId,
				});
				refetch();
			} catch (error) {
				console.error('Failed to start service:', error);
				toast.error(`Failed to start service: ${service.name}`, {
					id: toastId,
					description: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
		[startService, refetch]
	);

	const handleStopService = useCallback(
		async (service: SystemdService) => {
			if (!service.name) return;

			const toastId = toast.loading(`Stopping service: ${service.name}`, {
				description: 'Please wait...',
			});

			try {
				await stopService.mutateAsync({ name: service.name });
				toast.success(`Service stopped: ${service.name}`, {
					id: toastId,
				});
				refetch();
			} catch (error) {
				console.error('Failed to stop service:', error);
				toast.error(`Failed to stop service: ${service.name}`, {
					id: toastId,
					description: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
		[stopService, refetch]
	);

	const handleRestartService = useCallback(
		async (service: SystemdService) => {
			if (!service.name) return;

			const toastId = toast.loading(`Restarting service: ${service.name}`, {
				description: 'Please wait...',
			});

			try {
				await restartService.mutateAsync({ name: service.name });
				toast.success(`Service restarted: ${service.name}`, {
					id: toastId,
				});
				refetch();
			} catch (error) {
				console.error('Failed to restart service:', error);
				toast.error(`Failed to restart service: ${service.name}`, {
					id: toastId,
					description: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
		[restartService, refetch]
	);

	// Bulk actions
	const handleBulkStart = useCallback(
		async (rows: Row<SystemdService>[]) => {
			const services = rows.map(row => row.original).filter(service => service.name);

			if (services.length === 0) {
				toast.warning('No valid services selected');
				return;
			}

			const toastId = toast.loading(`Starting ${services.length} services...`);
			let successCount = 0;
			let failCount = 0;

			for (const service of services) {
				try {
					if (service.name) {
						await startService.mutateAsync({ name: service.name });
						successCount++;
					}
				} catch (error) {
					console.error(`Failed to start service ${service.name || 'unknown'}:`, error);
					failCount++;
				}
			}

			if (failCount === 0) {
				toast.success(`Successfully started ${successCount} services`, { id: toastId });
			} else if (successCount === 0) {
				toast.error(`Failed to start all ${failCount} services`, { id: toastId });
			} else {
				toast.warning(`Started ${successCount} services, failed to start ${failCount} services`, { id: toastId });
			}

			refetch();
		},
		[startService, refetch]
	);

	const handleBulkStop = useCallback(
		async (rows: Row<SystemdService>[]) => {
			const services = rows.map(row => row.original).filter(service => service.name);

			if (services.length === 0) {
				toast.warning('No valid services selected');
				return;
			}

			const toastId = toast.loading(`Stopping ${services.length} services...`);
			let successCount = 0;
			let failCount = 0;

			for (const service of services) {
				try {
					if (service.name) {
						await stopService.mutateAsync({ name: service.name });
						successCount++;
					}
				} catch (error) {
					console.error(`Failed to stop service ${service.name || 'unknown'}:`, error);
					failCount++;
				}
			}

			if (failCount === 0) {
				toast.success(`Successfully stopped ${successCount} services`, { id: toastId });
			} else if (successCount === 0) {
				toast.error(`Failed to stop all ${failCount} services`, { id: toastId });
			} else {
				toast.warning(`Stopped ${successCount} services, failed to stop ${failCount} services`, { id: toastId });
			}

			refetch();
		},
		[stopService, refetch]
	);

	const handleBulkRestart = useCallback(
		async (rows: Row<SystemdService>[]) => {
			const services = rows.map(row => row.original).filter(service => service.name);

			if (services.length === 0) {
				toast.warning('No valid services selected');
				return;
			}

			const toastId = toast.loading(`Restarting ${services.length} services...`);
			let successCount = 0;
			let failCount = 0;

			for (const service of services) {
				try {
					if (service.name) {
						await restartService.mutateAsync({ name: service.name });
						successCount++;
					}
				} catch (error) {
					console.error(`Failed to restart service ${service.name || 'unknown'}:`, error);
					failCount++;
				}
			}

			if (failCount === 0) {
				toast.success(`Successfully restarted ${successCount} services`, { id: toastId });
			} else if (successCount === 0) {
				toast.error(`Failed to restart all ${failCount} services`, { id: toastId });
			} else {
				toast.warning(`Restarted ${successCount} services, failed to restart ${failCount} services`, { id: toastId });
			}

			refetch();
		},
		[restartService, refetch]
	);

	function getStatusBadge(activeState?: string, subState?: string) {
		const service: SystemdService = { activeState, subState };

		if (isServiceRunning(service)) {
			return (
				<Badge className="bg-green-500">
					<CheckCircle className="mr-1 h-3 w-3" /> Running
				</Badge>
			);
		}
		if (activeState === 'active') {
			return (
				<Badge className="bg-blue-500">
					<Activity className="mr-1 h-3 w-3" /> Active
				</Badge>
			);
		}
		if (activeState === 'inactive') {
			return (
				<Badge className="bg-gray-500">
					<Clock className="mr-1 h-3 w-3" /> Inactive
				</Badge>
			);
		}
		if (activeState === 'failed') {
			return (
				<Badge className="bg-red-500">
					<AlertCircle className="mr-1 h-3 w-3" /> Failed
				</Badge>
			);
		}
		return <Badge className="bg-yellow-500">{activeState || 'Unknown'}</Badge>;
	}

	// Define columns for the data table
	const columns: ColumnDef<SystemdService>[] = [
		{
			id: 'select',
			header: ({ table }) => (
				<Checkbox
					checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
					onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={value => row.toggleSelected(!!value)}
					aria-label="Select row"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: 'name',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
			cell: ({ row }) => (
				<Button
					variant="link"
					className="p-0 h-auto font-medium text-foreground hover:underline hover:cursor-pointer"
					onClick={() => navigate(`/systemd/${row.getValue('name')}`)}
				>
					{row.getValue('name')}
				</Button>
			),
			enableSorting: true,
		},
		{
			accessorKey: 'description',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
			cell: ({ row }) => <div>{row.original.description || '-'}</div>,
			enableSorting: true,
		},
		{
			accessorKey: 'activeState',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => (
				<div>
					{getStatusBadge(row.original.activeState, row.original.subState)}
					{row.original.subState && row.original.subState !== 'running' && (
						<span className="ml-2 text-xs text-muted-foreground">{row.original.subState}</span>
					)}
				</div>
			),
			enableSorting: true,
			filterFn: (row, _, filterValue) => {
				if (!filterValue) return true;

				// Handle array of filter values (multiple checkboxes selected)
				if (Array.isArray(filterValue)) {
					if (filterValue.length === 0) return true;

					return filterValue.some(value => {
						if (value === 'active:running') {
							return isServiceRunning(row.original);
						}
						return row.original.activeState === value;
					});
				}

				// Handle single filter value (for backward compatibility)
				if (filterValue === 'active:running') {
					return isServiceRunning(row.original);
				}

				return row.original.activeState === filterValue;
			},
			sortingFn: (rowA, rowB) => {
				// Custom sorting function for status column
				const getStatusPriority = (service: SystemdService) => {
					// Priority order: running > active > inactive > failed > unknown
					if (isServiceRunning(service)) return 0;
					if (service.activeState === 'active') return 1;
					if (service.activeState === 'inactive') return 2;
					if (service.activeState === 'failed') return 3;
					return 4; // unknown or other states
				};

				const priorityA = getStatusPriority(rowA.original);
				const priorityB = getStatusPriority(rowB.original);
				return priorityA - priorityB;
			},
		},
		{
			accessorKey: 'memoryUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Memory" />,
			cell: ({ row }) => {
				const service = row.original;

				if (!isServiceRunning(service)) return <div>-</div>;

				return <div>{service.memoryUsage !== undefined ? formatBytes(service.memoryUsage) : '-'}</div>;
			},
			enableSorting: true,
		},
		{
			accessorKey: 'cpuUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="CPU" />,
			cell: ({ row }) => {
				const service = row.original;

				if (!isServiceRunning(service)) return <div>-</div>;

				const cpuUsage = service.cpuUsage;

				// Handle special cases
				if (cpuUsage === undefined) return <div>-</div>;

				// Special value -1 indicates first measurement (no data yet)
				if (cpuUsage === -1) return <div className="text-muted-foreground">Measuring...</div>;

				// Format CPU usage as percentage with 2 decimal places
				const formattedCPU = cpuUsage.toFixed(2);

				return <div>{formattedCPU}%</div>;
			},
			enableSorting: true,
		},
		{
			accessorKey: 'uptime',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Uptime" />,
			cell: ({ row }) => {
				const uptime = row.original.uptime;
				if (uptime === undefined || uptime <= 0) return <div>-</div>;

				return <div>{formatDuration(uptime)}</div>;
			},
			enableSorting: true,
		},
	];

	// Row actions component for the data table
	const renderRowActions = useCallback(
		(row: Row<SystemdService>) => {
			const service = row.original;
			const isRunning = isServiceRunning(service);

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center">
							<MoreHorizontal className="h-5 w-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => handleViewDetails(service)}>
							<Info className="mr-2 h-4 w-4" />
							View Details
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => handleViewLogs(service)}>
							<FileText className="mr-2 h-4 w-4" />
							View Logs
						</DropdownMenuItem>
						{!isRunning ? (
							<DropdownMenuItem onClick={() => handleStartService(service)}>
								<Play className="mr-2 h-4 w-4" />
								Start
							</DropdownMenuItem>
						) : (
							<>
								<DropdownMenuItem onClick={() => handleStopService(service)}>
									<Square className="mr-2 h-4 w-4" />
									Stop
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleRestartService(service)}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Restart
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[handleViewDetails, handleViewLogs, handleStartService, handleStopService, handleRestartService]
	);

	// Bulk actions component for the data table
	const renderBulkActions = useCallback(
		(rows: Row<SystemdService>[]) => {
			return (
				<>
					<Button variant="outline" size="sm" onClick={() => handleBulkStart(rows)}>
						<Play className="mr-2 h-4 w-4" />
						Start
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleBulkStop(rows)}>
						<Square className="mr-2 h-4 w-4" />
						Stop
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleBulkRestart(rows)}>
						<RotateCcw className="mr-2 h-4 w-4" />
						Restart
					</Button>
				</>
			);
		},
		[handleBulkStart, handleBulkStop, handleBulkRestart]
	);

	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">Systemd Services</h1>
				{!isLoading && !error && (
					<Badge variant="outline" className="text-sm">
						{count} services
					</Badge>
				)}
			</div>
			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						<span>Failed to load systemd services</span>
						<Button variant="outline" size="sm" onClick={() => handleRefresh()} className="mt-2">
							Try Again
						</Button>
					</AlertTitle>
				</Alert>
			) : (
				<DataTable
					columns={columns}
					data={services}
					searchColumn="name"
					enableRowSelection
					rowActions={renderRowActions}
					bulkActions={renderBulkActions}
					toolbar={table => (
						<DataTableToolbar
							table={table}
							searchColumn="name"
							searchPlaceholder="Search services..."
							filterColumn="activeState"
							filterOptions={[
								{
									label: 'Running',
									value: 'active:running',
									count: services.filter(s => isServiceRunning(s)).length,
								},
								{
									label: 'Active',
									value: 'active',
									count: services.filter(s => s.activeState === 'active' && s.subState !== 'running').length,
								},
								{
									label: 'Inactive',
									value: 'inactive',
									count: services.filter(s => s.activeState === 'inactive').length,
								},
								{
									label: 'Failed',
									value: 'failed',
									count: services.filter(s => s.activeState === 'failed').length,
								},
							]}
							onRefresh={handleRefresh}
							isLoading={isLoading || isRefreshing}
						/>
					)}
				/>
			)}
		</div>
	);
}
