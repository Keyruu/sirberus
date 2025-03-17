import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Table as TableType } from '@tanstack/react-table';
import { ChevronDown, Filter, Loader2, RefreshCw, Search, Settings2 } from 'lucide-react';

interface DataTableToolbarProps<TData> {
	table: TableType<TData>;
	searchColumn?: string;
	searchPlaceholder?: string;
	filterColumn?: string;
	filterOptions?: { label: string; value: string; count?: number }[];
	onRefresh?: () => void;
	isLoading?: boolean;
}

export function DataTableToolbar<TData>({
	table,
	searchColumn,
	searchPlaceholder = 'Search...',
	filterColumn,
	filterOptions,
	onRefresh,
	isLoading,
}: DataTableToolbarProps<TData>) {
	// Get the current filter value as an array
	const getFilterValues = () => {
		const filterValue = table.getColumn(filterColumn!)?.getFilterValue();
		if (!filterValue) return [];
		return Array.isArray(filterValue) ? filterValue : [filterValue];
	};

	// Get selected filter labels
	const getSelectedFilterLabels = () => {
		const filterValues = getFilterValues();
		return filterOptions?.filter(option => filterValues.includes(option.value)).map(option => option.label);
	};

	const selectedFilters = getSelectedFilterLabels() || [];
	const hasFilters = selectedFilters.length > 0;

	// Handle checkbox change
	const handleCheckboxChange = (value: string, checked: boolean) => {
		const filterValues = getFilterValues();

		if (checked) {
			// Add the value to the filter
			table.getColumn(filterColumn!)?.setFilterValue([...filterValues, value]);
		} else {
			// Remove the value from the filter
			table.getColumn(filterColumn!)?.setFilterValue(filterValues.filter(v => v !== value));
		}
	};

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center space-x-2">
				{searchColumn && (
					<div className="relative w-[150px] lg:w-[250px]">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={searchPlaceholder}
							value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''}
							onChange={event => table.getColumn(searchColumn)?.setFilterValue(event.target.value)}
							className="h-8 pl-8"
						/>
					</div>
				)}
				{filterColumn && filterOptions && table.getColumn(filterColumn) && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-1 border-dashed">
								<Filter className="h-4 w-4" />
								Status
								{hasFilters && (
									<Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
										{selectedFilters.length}
									</Badge>
								)}
								<ChevronDown className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-[200px]">
							<div className="max-h-[300px] overflow-y-auto py-1">
								{filterOptions?.map(option => {
									const filterValues = getFilterValues();
									const isChecked = filterValues.includes(option.value);

									return (
										<DropdownMenuCheckboxItem
											key={option.value}
											checked={isChecked}
											onCheckedChange={checked => handleCheckboxChange(option.value, checked as boolean)}
											className="flex items-center gap-2 border-b border-border/20 py-1.5 last:border-none"
										>
											{option.label}
											<span className="ml-auto text-xs text-muted-foreground">{option.count}</span>
										</DropdownMenuCheckboxItem>
									);
								})}
							</div>
							{hasFilters && (
								<>
									<DropdownMenuSeparator />
									<div className="p-1">
										<Button
											variant="ghost"
											size="sm"
											className="w-full justify-center text-xs"
											onClick={() => table.resetColumnFilters()}
										>
											Clear filters
										</Button>
									</div>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				{onRefresh && (
					<Button
						variant="outline"
						size="sm"
						onClick={onRefresh}
						disabled={isLoading}
						title="Refresh services"
						className="h-8 flex items-center gap-1"
					>
						{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
						{isLoading ? 'Refreshing...' : 'Refresh'}
					</Button>
				)}
			</div>
			<div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 gap-1">
							<Settings2 className="h-4 w-4" />
							View
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-[200px]">
						<div className="max-h-[300px] overflow-y-auto py-1">
							{table
								.getAllColumns()
								.filter(column => column.getCanHide())
								.map(column => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											checked={column.getIsVisible()}
											onCheckedChange={value => column.toggleVisibility(!!value)}
											className="flex items-center gap-2 border-b border-border/20 py-1.5 last:border-none"
										>
											{column.id.charAt(0).toUpperCase() + column.id.slice(1)}
										</DropdownMenuCheckboxItem>
									);
								})}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
