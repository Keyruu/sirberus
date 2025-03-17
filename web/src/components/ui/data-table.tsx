import {
	ColumnDef,
	ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	SortingState,
	Table as TableType,
	useReactTable,
	VisibilityState,
} from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	searchColumn?: string;
	toolbar?: (table: TableType<TData>) => React.ReactNode;
	pageSize?: number;
	pageSizeOptions?: number[];
}

export function DataTable<TData, TValue>({
	columns,
	data,
	toolbar,
	pageSize = 10,
	pageSizeOptions = [5, 10, 20, 50, 100],
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize,
	});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onPaginationChange: setPagination,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
		},
		manualPagination: false,
		// We'll calculate pageCount based on filtered rows in the UI
	});

	// Reset to first page when filters change if current page would be out of bounds
	useEffect(() => {
		const filteredRowCount = table.getFilteredRowModel().rows.length;
		const pageSize = pagination.pageSize;
		const totalPages = Math.max(1, Math.ceil(filteredRowCount / pageSize));

		// If current page is beyond the available pages after filtering, reset to first page
		if (pagination.pageIndex >= totalPages) {
			table.setPageIndex(0);
		}
	}, [table, columnFilters, pagination.pageSize, pagination.pageIndex]);

	return (
		<div className="space-y-4">
			{toolbar && toolbar(table)}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map(headerGroup => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map(header => (
									<TableHead key={header.id}>
										{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map(row => (
								<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
									{row.getVisibleCells().map(cell => (
										<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between space-x-2">
				<div className="flex items-center space-x-2">
					<p className="text-sm font-medium">Rows per page</p>
					<Select
						value={table.getState().pagination.pageSize.toString()}
						onValueChange={value => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger className="h-8 w-[70px]">
							<SelectValue placeholder={table.getState().pagination.pageSize.toString()} />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map(pageSize => (
								<SelectItem key={pageSize} value={pageSize.toString()}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex-1 text-sm text-muted-foreground text-center">
					{/* Calculate total pages based on filtered rows */}
					{(() => {
						const filteredRowCount = table.getFilteredRowModel().rows.length;
						const pageSize = table.getState().pagination.pageSize;
						const totalPages = Math.max(1, Math.ceil(filteredRowCount / pageSize));

						return (
							<>
								Page {table.getState().pagination.pageIndex + 1} of {totalPages} {' | '}
								{filteredRowCount} row(s)
							</>
						);
					})()}
				</div>
				<div className="space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
}
