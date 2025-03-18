import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
	'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
	{
		variants: {
			variant: {
				default: 'bg-card text-card-foreground border-border',
				destructive:
					'border-destructive/30 bg-destructive/10 dark:bg-red-950/50 text-destructive dark:text-red-300 [&>svg]:text-destructive dark:[&>svg]:text-red-300 *:data-[slot=alert-description]:text-destructive/90 dark:*:data-[slot=alert-description]:text-red-300/90',
				success:
					'border-green-500/30 bg-green-500/10 dark:bg-green-950/50 text-green-600 dark:text-green-300 [&>svg]:text-green-500 dark:[&>svg]:text-green-300 *:data-[slot=alert-description]:text-green-600/90 dark:*:data-[slot=alert-description]:text-green-300/90',
				warning:
					'border-yellow-500/30 bg-yellow-500/10 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-300 [&>svg]:text-yellow-500 dark:[&>svg]:text-yellow-300 *:data-[slot=alert-description]:text-yellow-600/90 dark:*:data-[slot=alert-description]:text-yellow-300/90',
				info: 'border-blue-500/30 bg-blue-500/10 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 [&>svg]:text-blue-500 dark:[&>svg]:text-blue-300 *:data-[slot=alert-description]:text-blue-600/90 dark:*:data-[slot=alert-description]:text-blue-300/90',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
);

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
	return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-title"
			className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
				className
			)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
