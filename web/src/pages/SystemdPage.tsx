import { BulkActionBar } from '@/components/systemd/services/BulkActionBar';
import { ServiceListHeader } from '@/components/systemd/services/ServiceListHeader';
import { ServiceStatusBadge } from '@/components/systemd/services/ServiceStatusBadge';
import { Alert, AlertTitle } from '@/components/ui/alert';
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
import { useSystemdActions } from '@/hooks/use-systemd-actions';
import { useSystemdServiceList } from '@/hooks/use-systemd-service-list';
import { formatBytes, formatDuration, isServiceRunning } from '@/lib/utils';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AlertCircle, FileText, Info, MoreHorizontal, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export default function SystemdPage() {
	const navigate = useNavigate();

	// Use our custom hooks
	const { services, count, isLoading, error, refetch, isRefreshing, statusCounts } = useSystemdServiceList();

	const { startService, stopService, restartService, bulkStartServices, bulkStopServices, bulkRestartServices } =
		useSystemdActions();

	// Service action handlers
	const handleViewDetails = useCallback(
		(service: SystemdService) => {
			if (!service.name) return;
			navigate(`/systemd/${service.name}`);
		},
		[navigate]
	);

	const handleViewLogs = useCallback(
		(service: SystemdService) => {
			if (!service.name) return;
			navigate(`/systemd/${service.name}/logs`);
		},
		[navigate]
	);

	// Define columns for the data table
	const columns: ColumnDef<SystemdService>[] = [
		{
			id: 'select',
			header: ({ table }) => (
				<Checkbox
					checked={table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()}
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
					onClick={() => handleViewDetails(row.original)}
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
					<ServiceStatusBadge service={row.original} />
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
				if (cpuUsage === undefined) return <div>-</div>;
				if (cpuUsage === -1) return <div className="text-muted-foreground">Measuring...</div>;
				return <div>{cpuUsage.toFixed(2)}%</div>;
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
							<DropdownMenuItem onClick={() => startService(service.name || '', refetch)}>
								<Play className="mr-2 h-4 w-4" />
								Start
							</DropdownMenuItem>
						) : (
							<>
								<DropdownMenuItem onClick={() => stopService(service.name || '', refetch)}>
									<Square className="mr-2 h-4 w-4" />
									Stop
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => restartService(service.name || '', refetch)}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Restart
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[handleViewDetails, handleViewLogs, startService, stopService, restartService, refetch]
	);

	// Bulk actions component for the data table
	const renderBulkActions = useCallback(
		(rows: Row<SystemdService>[]) => {
			const selectedServices = rows.map(row => row.original);

			return (
				<BulkActionBar
					selectedCount={rows.length}
					onBulkStart={() => bulkStartServices(selectedServices, refetch)}
					onBulkStop={() => bulkStopServices(selectedServices, refetch)}
					onBulkRestart={() => bulkRestartServices(selectedServices, refetch)}
				/>
			);
		},
		[bulkStartServices, bulkStopServices, bulkRestartServices, refetch]
	);

	return (
		<div className="p-6">
			<ServiceListHeader title="Systemd Services" count={count} isLoading={isLoading} />

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
						<Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
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
									count: statusCounts.running,
								},
								{
									label: 'Active',
									value: 'active',
									count: statusCounts.active,
								},
								{
									label: 'Inactive',
									value: 'inactive',
									count: statusCounts.inactive,
								},
								{
									label: 'Failed',
									value: 'failed',
									count: statusCounts.failed,
								},
							]}
							onRefresh={refetch}
							isLoading={isLoading || isRefreshing}
						/>
					)}
				/>
			)}
		</div>
	);
}
