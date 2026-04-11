import type { Band, ChannelWidth } from './types.js';

// Real-world single-client throughput (Mbps) by band and channel width
// These are conservative estimates based on WiFi 6 (802.11ax) typical performance
const BASE_RATES: Record<string, number> = {
	'2.4ghz_20': 45,
	'2.4ghz_40': 90,
	'5ghz_20': 70,
	'5ghz_40': 140,
	'5ghz_80': 300,
	'5ghz_160': 550,
	'6ghz_20': 90,
	'6ghz_40': 180,
	'6ghz_80': 400,
	'6ghz_160': 750,
	'6ghz_320': 1200
};

export interface ThroughputEstimate {
	apId: string;
	baseRate: number; // max single-client throughput for this band/width
	effectiveRate: number; // after co-channel contention
	cappedRate: number; // after ISP bottleneck
	meetsTarget: boolean; // above the target threshold
}

export interface ThroughputInput {
	apId: string;
	band: Band;
	channelWidth: ChannelWidth;
	assignedChannel: number | null;
	coChannelOverlaps: number[]; // overlap fractions with other APs on the same channel
}

export interface ThroughputOptions {
	ispSpeed: number; // Mbps, 0 = no limit
	targetThroughput: number; // minimum acceptable Mbps per AP
	macEfficiency?: number; // default 0.5
}

export function estimateThroughput(
	aps: ThroughputInput[],
	options: ThroughputOptions
): ThroughputEstimate[] {
	const efficiency = options.macEfficiency ?? 0.5;

	return aps.map((ap) => {
		const key = `${ap.band}_${ap.channelWidth}`;
		const baseRate = (BASE_RATES[key] ?? 100) * efficiency;

		// Co-channel contention: N_effective = 1 + sum of overlaps
		const nEffective = 1 + ap.coChannelOverlaps.reduce((sum, f) => sum + f, 0);
		const effectiveRate = baseRate / nEffective;

		// ISP bottleneck cap
		const cappedRate =
			options.ispSpeed > 0 ? Math.min(effectiveRate, options.ispSpeed) : effectiveRate;

		return {
			apId: ap.apId,
			baseRate: Math.round(baseRate),
			effectiveRate: Math.round(effectiveRate),
			cappedRate: Math.round(cappedRate),
			meetsTarget: cappedRate >= options.targetThroughput
		};
	});
}

export function getBaseRate(band: Band, channelWidth: ChannelWidth): number {
	const key = `${band}_${channelWidth}`;
	return BASE_RATES[key] ?? 100;
}
