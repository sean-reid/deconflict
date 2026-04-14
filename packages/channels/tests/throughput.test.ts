import { describe, it, expect } from 'vitest';
import { estimateThroughput, getBaseRate } from '../src/throughput.js';
import type { ThroughputInput, ThroughputOptions } from '../src/throughput.js';

describe('estimateThroughput', () => {
	const defaultOptions: ThroughputOptions = {
		ispSpeed: 0,
		targetThroughput: 50,
		macEfficiency: 0.5
	};

	it('single AP, no contention: effectiveRate equals baseRate', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [],
				wifiStandard: 'WiFi 6',
				streams: 2
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		expect(results).toHaveLength(1);
		const est = results[0]!;
		// WiFi 6, 2 streams, 80MHz = 1201 PHY. * 0.5 MAC = 601
		expect(est.baseRate).toBe(601);
		expect(est.effectiveRate).toBe(601);
		expect(est.cappedRate).toBe(601);
		expect(est.meetsTarget).toBe(true);
	});

	it('two APs on same channel with overlap 1.0: each gets roughly half', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [1.0],
				wifiStandard: 'WiFi 6',
				streams: 2
			},
			{
				apId: 'ap2',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [1.0],
				wifiStandard: 'WiFi 6',
				streams: 2
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		// baseRate = 601; nEffective = 1 + 1 = 2; effectiveRate = 300
		expect(results[0]!.effectiveRate).toBe(300);
		expect(results[1]!.effectiveRate).toBe(300);
	});

	it('ISP cap applied when lower than radio rate', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [],
				wifiStandard: 'WiFi 6',
				streams: 2
			}
		];

		const options: ThroughputOptions = {
			ispSpeed: 100,
			targetThroughput: 50,
			macEfficiency: 0.5
		};

		const results = estimateThroughput(aps, options);
		expect(results[0]!.effectiveRate).toBe(601);
		expect(results[0]!.cappedRate).toBe(100);
	});

	it('model-specific rates: WiFi 5 2x2 vs WiFi 6 4x4', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'wifi5',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [],
				wifiStandard: 'WiFi 5',
				streams: 2
			},
			{
				apId: 'wifi6',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 40,
				coChannelOverlaps: [],
				wifiStandard: 'WiFi 6',
				streams: 4
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		// WiFi 5 2x2 80MHz = 867 * 0.5 = 434
		expect(results[0]!.baseRate).toBe(434);
		// WiFi 6 4x4 80MHz = 2401 * 0.5 = 1201
		expect(results[1]!.baseRate).toBe(1201);
	});

	it('falls back to WiFi 6 2-stream when no model info', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: []
				// no wifiStandard or streams
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		// Default: WiFi 6, 2 streams, 80MHz = 1201 * 0.5 = 601
		expect(results[0]!.baseRate).toBe(601);
	});
});

describe('getBaseRate', () => {
	it('returns WiFi 6 2-stream rate for 5ghz 80MHz', () => {
		// WiFi 6, 2 streams, 80MHz = 1201
		expect(getBaseRate('5ghz', 80)).toBe(1201);
	});

	it('returns WiFi 6 2-stream rate for 6ghz 160MHz', () => {
		// WiFi 6, 2 streams, 160MHz = 2402
		expect(getBaseRate('6ghz', 160)).toBe(2402);
	});
});
