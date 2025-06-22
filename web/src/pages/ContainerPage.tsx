import { ContainerBulkActionBar } from '@/components/container/ContainerBulkActionBar';
import { ContainerStatusBadge } from '@/components/container/ContainerStatusBadge';
import { ListHeader } from '@/components/shared/ListHeader';
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
import { Container } from '@/generated/model';
import { useContainerActions } from '@/hooks/use-container-actions';
import { useContainerList } from '@/hooks/use-container-list';
import { formatBytes } from '@/lib/utils';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AlertCircle, FileText, Info, MoreHorizontal, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';

export function ContainerPage() {
	const { containers, count, isLoading, error, refetch, isRefreshing, statusCounts } = useContainerList();
	const {
		startContainer,
		stopContainer,
		restartContainer,
		bulkStartContainers,
		bulkStopContainers,
		bulkRestartContainers,
	} = useContainerActions();

	// Define columns for the data table
	const columns: ColumnDef<Container>[] = [
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
				<div className="flex flex-col">
					<Link to={`/container/${row.original.id}`} className="font-medium hover:underline">
						{row.original.name || row.original.id}
					</Link>
					<span className="text-sm text-muted-foreground">{row.original.image}</span>
				</div>
			),
			enableSorting: true,
		},
		{
			accessorKey: 'status',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => <ContainerStatusBadge container={row.original} />,
			enableSorting: true,
			filterFn: (row, _, filterValue) => {
				if (!filterValue) return true;

				const container = row.original;
				const status = container.status;

				if (Array.isArray(filterValue)) {
					if (filterValue.length === 0) return true;
					return filterValue.some(value => {
						if (value === 'running') return status?.running || false;
						if (value === 'exited') return status?.state === 'exited' || false;
						if (value === 'created') return status?.state === 'created' || false;
						return status?.state?.toLowerCase().includes(value.toLowerCase()) || false;
					});
				}

				if (filterValue === 'running') return status?.running || false;
				if (filterValue === 'exited') return status?.state === 'exited' || false;
				if (filterValue === 'created') return status?.state === 'created' || false;
				return status?.state?.toLowerCase().includes(filterValue.toLowerCase()) || false;
			},
		},
		{
			accessorKey: 'ports',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Ports" />,
			cell: ({ row }) => (
				<div className="text-sm text-muted-foreground break-words whitespace-normal max-w-xs">
					{row.original.ports || '-'}
				</div>
			),
			enableSorting: true,
		},
		{
			accessorKey: 'memoryUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="Memory" />,
			cell: ({ row }) => {
				const container = row.original;
				if (!container.status?.running) return <div>-</div>;
				return <div>{container.memoryUsage ? formatBytes(container.memoryUsage) : '-'}</div>;
			},
			enableSorting: true,
		},
		{
			accessorKey: 'cpuUsage',
			header: ({ column }) => <DataTableColumnHeader column={column} title="CPU" />,
			cell: ({ row }) => {
				const container = row.original;
				if (!container.status?.running) return <div>-</div>;
				const cpuUsage = container.cpuUsage;
				if (cpuUsage === undefined) return <div>-</div>;
				return <div>{(cpuUsage / 1e9).toFixed(2)}%</div>;
			},
			enableSorting: true,
		},
	];

	// Row actions component for the data table
	const renderRowActions = useCallback(
		(row: Row<Container>) => {
			const container = row.original;

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center">
							<MoreHorizontal className="h-5 w-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem asChild>
							<Link to={`/container/${container.id}`} className="font-medium hover:underline">
								<Info className="mr-2 h-4 w-4" />
								View Details
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to={`/container/${container.id}/logs`} className="font-medium hover:underline">
								<FileText className="mr-2 h-4 w-4" />
								View Logs
							</Link>
						</DropdownMenuItem>
						{!container.status?.running ? (
							<DropdownMenuItem onClick={() => startContainer(container.id || '', refetch)}>
								<Play className="mr-2 h-4 w-4" />
								Start
							</DropdownMenuItem>
						) : (
							<>
								<DropdownMenuItem onClick={() => stopContainer(container.id || '', refetch)}>
									<Square className="mr-2 h-4 w-4" />
									Stop
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => restartContainer(container.id || '', refetch)}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Restart
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[startContainer, stopContainer, restartContainer, refetch]
	);

	// Bulk actions component for the data table
	const renderBulkActions = useCallback(
		(rows: Row<Container>[]) => {
			const selectedContainers = rows.map(row => row.original);

			return (
				<ContainerBulkActionBar
					selectedCount={rows.length}
					onBulkStart={() => bulkStartContainers(selectedContainers, refetch)}
					onBulkStop={() => bulkStopContainers(selectedContainers, refetch)}
					onBulkRestart={() => bulkRestartContainers(selectedContainers, refetch)}
				/>
			);
		},
		[bulkStartContainers, bulkStopContainers, bulkRestartContainers, refetch]
	);

	return (
		<div className="p-6">
			<ListHeader title="Containers" count={count} isLoading={isLoading} />

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
						<span>Failed to load containers</span>
						<Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
							Try Again
						</Button>
					</AlertTitle>
				</Alert>
			) : (
				<DataTable
					columns={columns}
					data={containers}
					searchColumn="name"
					enableRowSelection
					rowActions={renderRowActions}
					bulkActions={renderBulkActions}
					toolbar={table => (
						<DataTableToolbar
							table={table}
							searchColumn="name"
							searchPlaceholder="Search containers..."
							filterColumn="status"
							filterOptions={[
								{
									label: 'Running',
									value: 'running',
									count: statusCounts.running,
								},
								{
									label: 'Exited',
									value: 'exited',
									count: statusCounts.exited,
								},
								{
									label: 'Created',
									value: 'created',
									count: statusCounts.created,
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
