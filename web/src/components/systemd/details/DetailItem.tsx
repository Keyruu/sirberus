import { ReactNode } from 'react';

interface DetailItemProps {
	label: string;
	value: ReactNode;
	className?: string;
}

export function DetailItem({ label, value, className = '' }: DetailItemProps) {
	return (
		<div className={`flex justify-between py-2 ${className}`}>
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
