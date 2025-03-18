import {
	ColumnDef,
	ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	Row,
	SortingState,
	Table as TableType,
	useReactTable,
	VisibilityState,
} from '@tanstack/react-table';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Button } from './button';

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	searchColumn?: string;
	toolbar?: (table: TableType<TData>) => React.ReactNode;
	pageSize?: number;
	pageSizeOptions?: number[];
	enableRowSelection?: boolean;
	onRowSelectionChange?: (rows: Row<TData>[]) => void;
	rowActions?: (row: Row<TData>) => React.ReactNode;
	bulkActions?: (rows: Row<TData>[]) => React.ReactNode;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	toolbar,
	pageSize = 10,
	pageSizeOptions = [5, 10, 20, 50, 100],
	enableRowSelection = false,
	onRowSelectionChange,
	rowActions,
	bulkActions,
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
		enableRowSelection,
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

	// Get selected rows for bulk actions
	const selectedRows = table.getRowModel().rows.filter(row => row.getIsSelected());

	// Call onRowSelectionChange when selected rows change
	useEffect(() => {
		if (onRowSelectionChange && Object.keys(rowSelection).length > 0) {
			onRowSelectionChange(selectedRows);
		}
	}, [rowSelection, onRowSelectionChange, selectedRows]);

	return (
		<div className="space-y-4">
			{toolbar && toolbar(table)}
			{selectedRows.length > 0 && bulkActions && (
				<div className="bg-muted p-2 rounded-md flex items-center justify-between">
					<div className="text-sm font-medium">
						{selectedRows.length} {selectedRows.length === 1 ? 'row' : 'rows'} selected
					</div>
					<div className="flex space-x-2">{bulkActions(selectedRows)}</div>
				</div>
			)}
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
								{rowActions && <TableHead className="w-[50px]"></TableHead>}
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
									{rowActions && <TableCell className="text-right w-[50px] p-2">{rowActions(row)}</TableCell>}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length + (rowActions ? 1 : 0)} className="h-24 text-center">
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
