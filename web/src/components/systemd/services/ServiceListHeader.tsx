import { Badge } from '@/components/ui/badge';

interface ServiceListHeaderProps {
	title: string;
	count?: number;
	isLoading: boolean;
}

export function ServiceListHeader({ title, count, isLoading }: ServiceListHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-4">
			<h1 className="text-2xl font-bold">{title}</h1>
			{!isLoading && count !== undefined && (
				<Badge variant="outline" className="text-sm">
					{count} services
				</Badge>
			)}
		</div>
	);
}
