import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DataTableToolbar } from '@/components/ui/data-table-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemdService } from '@/generated/model';
import { useGetSystemd } from '@/generated/systemd/systemd';
import { formatBytes, formatDuration } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useCallback, useState } from 'react';

export default function SystemdPage() {
	const [isRefreshing, setIsRefreshing] = useState(false);

	const { data, isLoading, error, refetch } = useGetSystemd({
		query: {
			refetchInterval: 10000, // Refresh every 10 seconds
			queryKey: ['systemd-services'],
		},
	});

	// Handle manual refresh with UI feedback
	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await refetch();
		} catch {
			// Error handling is done by the query
		} finally {
			// Reset refreshing state after a short delay
			setTimeout(() => {
				setIsRefreshing(false);
			}, 500);
		}
	}, [refetch]);

	const services = data?.data?.services || [];
	const count = data?.data?.count || 0;

	function getStatusBadge(activeState?: string, subState?: string) {
		if (activeState === 'active' && subState === 'running') {
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
			accessorKey: 'name',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
			cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
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
							return row.original.activeState === 'active' && row.original.subState === 'running';
						}
						return row.original.activeState === value;
					});
				}

				// Handle single filter value (for backward compatibility)
				if (filterValue === 'active:running') {
					return row.original.activeState === 'active' && row.original.subState === 'running';
				}

				return row.original.activeState === filterValue;
			},
			sortingFn: (rowA, rowB) => {
				// Custom sorting function for status column
				const getStatusPriority = (activeState?: string, subState?: string) => {
					// Priority order: running > active > inactive > failed > unknown
					if (activeState === 'active' && subState === 'running') return 0;
					if (activeState === 'active') return 1;
					if (activeState === 'inactive') return 2;
					if (activeState === 'failed') return 3;
					return 4; // unknown or other states
				};

				const priorityA = getStatusPriority(rowA.original.activeState, rowA.original.subState);
				const priorityB = getStatusPriority(rowB.original.activeState, rowB.original.subState);
				return priorityA - priorityB;
			},
		},
		{
			accessorKey: 'memoryUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Memory" />,
			cell: ({ row }) => (
				<div>{row.original.memoryUsage !== undefined ? formatBytes(row.original.memoryUsage) : '-'}</div>
			),
			enableSorting: true,
		},
		{
			accessorKey: 'cpuUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="CPU" />,
			cell: ({ row }) => {
				const cpuUsage = row.original.cpuUsage;
				if (cpuUsage === undefined) return <div>-</div>;

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
				<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
					<div className="flex items-center">
						<AlertCircle className="h-5 w-5 mr-2" />
						<p>Failed to load systemd services</p>
					</div>
				</div>
			) : (
				<DataTable
					columns={columns}
					data={services}
					searchColumn="name"
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
									count: services.filter(s => s.activeState === 'active' && s.subState === 'running').length,
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
