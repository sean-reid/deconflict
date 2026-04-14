import type { Band, ChannelWidth } from './types.js';

/**
 * PHY data rates (Mbps) by WiFi standard, spatial streams, and channel width.
 * Values are single-user peak PHY rate at the highest common MCS index.
 *
 * Sources:
 *   - IEEE 802.11n (WiFi 4): MCS 7 per stream, 800ns GI
 *   - IEEE 802.11ac (WiFi 5): MCS 9 per stream, 800ns GI
 *   - IEEE 802.11ax (WiFi 6/6E): MCS 11 per stream, 800ns GI
 *   - IEEE 802.11be (WiFi 7): MCS 13 per stream, 800ns GI (4096-QAM)
 */
const PHY_RATES: Record<string, Record<number, number>> = {
	// WiFi 4 (802.11n) — max MCS 7 per stream
	wifi4_20: { 1: 72, 2: 144, 3: 217, 4: 289 },
	wifi4_40: { 1: 150, 2: 300, 3: 450, 4: 600 },

	// WiFi 5 (802.11ac) — max MCS 9 per stream, 256-QAM
	wifi5_20: { 1: 87, 2: 173, 3: 260, 4: 347 },
	wifi5_40: { 1: 200, 2: 400, 3: 600, 4: 800 },
	wifi5_80: { 1: 433, 2: 867, 3: 1300, 4: 1733 },
	wifi5_160: { 1: 867, 2: 1733, 3: 2600, 4: 3467 },

	// WiFi 6 (802.11ax) — max MCS 11 per stream, 1024-QAM
	wifi6_20: { 1: 143, 2: 287, 3: 430, 4: 574 },
	wifi6_40: { 1: 287, 2: 574, 3: 860, 4: 1147 },
	wifi6_80: { 1: 600, 2: 1201, 3: 1801, 4: 2401 },
	wifi6_160: { 1: 1201, 2: 2402, 3: 3603, 4: 4804 },

	// WiFi 6E (same PHY as WiFi 6, just 6 GHz band)
	wifi6e_20: { 1: 143, 2: 287, 3: 430, 4: 574 },
	wifi6e_40: { 1: 287, 2: 574, 3: 860, 4: 1147 },
	wifi6e_80: { 1: 600, 2: 1201, 3: 1801, 4: 2401 },
	wifi6e_160: { 1: 1201, 2: 2402, 3: 3603, 4: 4804 },

	// WiFi 7 (802.11be) — max MCS 13 per stream, 4096-QAM
	wifi7_20: { 1: 172, 2: 344, 3: 516, 4: 688 },
	wifi7_40: { 1: 344, 2: 689, 3: 1033, 4: 1376 },
	wifi7_80: { 1: 720, 2: 1441, 3: 2161, 4: 2882 },
	wifi7_160: { 1: 1441, 2: 2882, 3: 4323, 4: 5765 },
	wifi7_320: { 1: 2882, 2: 5765, 3: 8647, 4: 11529 }
};

/** Map wifiStandard string to PHY rate key prefix. */
function standardKey(wifiStandard: string): string {
	const s = wifiStandard.toLowerCase().replace(/[\s-]/g, '');
	if (s.includes('7') || s.includes('be')) return 'wifi7';
	if (s.includes('6e')) return 'wifi6e';
	if (s.includes('6') || s.includes('ax')) return 'wifi6';
	if (s.includes('5') || s.includes('ac')) return 'wifi5';
	return 'wifi4';
}

/** Get PHY data rate for a specific standard, streams, and channel width. */
export function getPhyRate(
	wifiStandard: string,
	streams: number,
	channelWidth: ChannelWidth
): number {
	const key = `${standardKey(wifiStandard)}_${channelWidth}`;
	const rates = PHY_RATES[key];
	if (!rates) return 100; // fallback
	return rates[Math.min(streams, 4)] ?? rates[2] ?? 100;
}

export interface ThroughputEstimate {
	apId: string;
	baseRate: number; // max single-client throughput for this config
	effectiveRate: number; // after co-channel contention
	cappedRate: number; // after ISP bottleneck
	meetsTarget: boolean; // above the target threshold
}

export interface ThroughputInput {
	apId: string;
	band: Band;
	channelWidth: ChannelWidth;
	assignedChannel: number | null;
	coChannelOverlaps: number[]; // attenuated signal from co-channel APs
	wifiStandard?: string;
	streams?: number;
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
		// Use model-specific PHY rate if available, otherwise generic fallback
		const phyRate =
			ap.wifiStandard && ap.streams
				? getPhyRate(ap.wifiStandard, ap.streams, ap.channelWidth)
				: getPhyRate('WiFi 6', 2, ap.channelWidth); // conservative default
		const baseRate = phyRate * efficiency;

		// Co-channel contention: N_effective = 1 + sum of overlapping signal strengths
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

export function getBaseRate(_band: Band, channelWidth: ChannelWidth): number {
	// Generic fallback for heatmap (no model info): WiFi 6, 2 streams
	return getPhyRate('WiFi 6', 2, channelWidth);
}
