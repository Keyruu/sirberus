import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileWarning } from 'lucide-react';

interface LogsErrorProps {
	error: string;
}

export function LogsError({ error }: LogsErrorProps) {
	return (
		<Alert variant="destructive">
			<FileWarning className="h-4 w-4" />
			<AlertTitle>Could not fetch logs</AlertTitle>
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	);
}
