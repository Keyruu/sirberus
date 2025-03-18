import { SystemdServiceDetails } from '@/generated/model';
import { useEffect, useState } from 'react';

interface DataPoint {
	timestamp: number;
	value: number;
}

interface MetricsState {
	cpuHistory: DataPoint[];
	memoryHistory: DataPoint[];
}

interface UseSystemdServiceMetricsOptions {
	maxDataPoints?: number;
}

interface UseSystemdServiceMetricsReturn {
	cpuHistory: DataPoint[];
	memoryHistory: DataPoint[];
	cpuChartData: { index: number; cpu: number }[];
	memoryChartData: { index: number; memory: number }[];
	hasChartData: boolean;
}

/**
 * Custom hook for managing systemd service metrics and chart data
 * Tracks CPU and memory usage over time for visualization
 */
export function useSystemdServiceMetrics(
	service: SystemdServiceDetails['service'] | undefined,
	options: UseSystemdServiceMetricsOptions = {}
): UseSystemdServiceMetricsReturn {
	const { maxDataPoints = 20 } = options;
	const [metrics, setMetrics] = useState<MetricsState>({
		cpuHistory: [],
		memoryHistory: [],
	});

	// Update history when service data changes
	useEffect(() => {
		if (service && service.activeState === 'active' && service.subState === 'running') {
			const now = Date.now();

			// Update CPU history if we have valid data
			if (service.cpuUsage !== undefined && service.cpuUsage >= 0) {
				setMetrics(prev => {
					const newCpuHistory = [...prev.cpuHistory, { timestamp: now, value: service.cpuUsage as number }];
					// Keep only the last maxDataPoints
					return {
						...prev,
						cpuHistory: newCpuHistory.slice(-maxDataPoints),
					};
				});
			}

			// Update memory history if we have valid data
			if (service.memoryUsage !== undefined) {
				setMetrics(prev => {
					const newMemoryHistory = [...prev.memoryHistory, { timestamp: now, value: service.memoryUsage as number }];
					// Keep only the last maxDataPoints
					return {
						...prev,
						memoryHistory: newMemoryHistory.slice(-maxDataPoints),
					};
				});
			}
		}
	}, [service, maxDataPoints]);

	// Format data for charts
	const cpuChartData = metrics.cpuHistory.map((point, index) => ({
		index,
		cpu: point.value,
	}));

	const memoryChartData = metrics.memoryHistory.map((point, index) => ({
		index,
		memory: point.value,
	}));

	// Check if we have enough data for charts
	const hasChartData = cpuChartData.length > 1 || memoryChartData.length > 1;

	return {
		cpuHistory: metrics.cpuHistory,
		memoryHistory: metrics.memoryHistory,
		cpuChartData,
		memoryChartData,
		hasChartData,
	};
}
