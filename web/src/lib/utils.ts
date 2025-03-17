import { type ClassValue, clsx } from 'clsx';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { twMerge } from 'tailwind-merge';

// Initialize dayjs plugins
dayjs.extend(duration);
dayjs.extend(relativeTime);

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format bytes to a human-readable string with appropriate units
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format seconds to a human-readable duration string using dayjs
 * This can handle longer durations including days
 */
export function formatDuration(seconds: number): string {
	if (seconds <= 0) return '0s';

	return dayjs.duration(seconds, 'seconds').humanize();
}
