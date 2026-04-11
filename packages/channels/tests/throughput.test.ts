import { describe, it, expect } from 'vitest';
import { estimateThroughput, getBaseRate } from '../src/throughput.js';
import type { ThroughputInput, ThroughputOptions } from '../src/throughput.js';

describe('estimateThroughput', () => {
	const defaultOptions: ThroughputOptions = {
		ispSpeed: 0,
		targetThroughput: 50,
		macEfficiency: 0.5
	};

	it('single AP, no contention: effectiveRate equals baseRate * efficiency', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: []
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		expect(results).toHaveLength(1);
		const est = results[0]!;
		// 300 * 0.5 = 150
		expect(est.baseRate).toBe(150);
		expect(est.effectiveRate).toBe(150);
		expect(est.cappedRate).toBe(150);
		expect(est.meetsTarget).toBe(true);
	});

	it('two APs on same channel with overlap 1.0: each gets roughly half', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [1.0]
			},
			{
				apId: 'ap2',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: [1.0]
			}
		];

		const results = estimateThroughput(aps, defaultOptions);
		// baseRate = 300 * 0.5 = 150; nEffective = 1 + 1 = 2; effectiveRate = 75
		expect(results[0]!.effectiveRate).toBe(75);
		expect(results[1]!.effectiveRate).toBe(75);
	});

	it('ISP cap applied when lower than radio rate', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: []
			}
		];

		const options: ThroughputOptions = {
			ispSpeed: 100,
			targetThroughput: 50,
			macEfficiency: 0.5
		};

		const results = estimateThroughput(aps, options);
		// effectiveRate = 150, but ISP cap = 100
		expect(results[0]!.effectiveRate).toBe(150);
		expect(results[0]!.cappedRate).toBe(100);
	});

	it('AP meets target when above threshold', () => {
		const aps: ThroughputInput[] = [
			{
				apId: 'ap1',
				band: '5ghz',
				channelWidth: 80,
				assignedChannel: 36,
				coChannelOverlaps: []
			}
		];

		const aboveTarget: ThroughputOptions = {
			ispSpeed: 0,
			targetThroughput: 100,
			macEfficiency: 0.5
		};
		expect(estimateThroughput(aps, aboveTarget)[0]!.meetsTarget).toBe(true);

		const belowTarget: ThroughputOptions = {
			ispSpeed: 0,
			targetThroughput: 200,
			macEfficiency: 0.5
		};
		expect(estimateThroughput(aps, belowTarget)[0]!.meetsTarget).toBe(false);
	});

	it('different bands give different base rates', () => {
		const make = (band: '2.4ghz' | '5ghz' | '6ghz'): ThroughputInput => ({
			apId: band,
			band,
			channelWidth: 20,
			assignedChannel: 1,
			coChannelOverlaps: []
		});

		const results = estimateThroughput(
			[make('2.4ghz'), make('5ghz'), make('6ghz')],
			defaultOptions
		);

		// 2.4ghz_20: 45*0.5=22.5->23, 5ghz_20: 70*0.5=35, 6ghz_20: 90*0.5=45
		expect(results[0]!.baseRate).toBe(23);
		expect(results[1]!.baseRate).toBe(35);
		expect(results[2]!.baseRate).toBe(45);
	});
});

describe('getBaseRate', () => {
	it('returns known rate for 5ghz 80MHz', () => {
		expect(getBaseRate('5ghz', 80)).toBe(300);
	});

	it('returns known rate for 6ghz 320MHz', () => {
		expect(getBaseRate('6ghz', 320)).toBe(1200);
	});

	it('returns fallback for unknown combination', () => {
		// 2.4ghz doesn't have 320 defined
		expect(getBaseRate('2.4ghz', 320 as any)).toBe(100);
	});
});
