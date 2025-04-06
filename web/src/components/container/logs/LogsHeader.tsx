import { ContainerStatusBadge } from '@/components/container/ContainerStatusBadge';
import { Button } from '@/components/ui/button';
import { Container } from '@/generated/model';
import { Link } from 'react-router';

interface LogsHeaderProps {
	container: Container;
}

export function LogsHeader({ container }: LogsHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-6">
			<div>
				<div className="flex items-center gap-2 mb-1">
					<h1 className="text-2xl font-bold">{container.name}</h1>
					<ContainerStatusBadge container={container} />
				</div>
				<p className="text-muted-foreground">{container.id}</p>
			</div>
			<Link to={`/container/${container.id}`}>
				<Button variant="outline">View Details</Button>
			</Link>
		</div>
	);
}
