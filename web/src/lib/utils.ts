import { SystemdService } from '@/generated/model';
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
 * Detects maximum uint64 values and returns "N/A" as these typically
 * represent unset or unmeasured values in systemd
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 Bytes';

	// In systemd, the max uint64 value (2^64-1 = 18,446,744,073,709,551,615)
	// is often used to indicate "unlimited" or "not set"
	// JavaScript can't precisely represent integers that large, but we can check
	// if the value is extremely large (beyond what's reasonable for these metrics)
	if (bytes > Number.MAX_SAFE_INTEGER) {
		// > 9,007,199,254,740,991
		return 'N/A';
	}

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

/**
 * Check if a systemd service is running
 * A service is considered running if its activeState is "active" and its subState is "running"
 */
export function isServiceRunning(service: SystemdService): boolean {
	return service.activeState === 'active' && service.subState === 'running';
}
