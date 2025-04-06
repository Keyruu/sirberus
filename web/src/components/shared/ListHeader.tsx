import { Badge } from '../ui/badge';

interface ListHeaderProps {
	title: string;
	count: number;
	isLoading: boolean;
}

export function ListHeader({ title, count, isLoading }: ListHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-4">
			<h1 className="text-2xl font-bold">{title}</h1>
			{!isLoading && count !== undefined && (
				<Badge variant="outline" className="text-sm">
					{count} {title.toLowerCase()}
				</Badge>
			)}
		</div>
	);
}
