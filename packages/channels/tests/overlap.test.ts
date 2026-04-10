import { describe, it, expect } from 'vitest';
import { channelsInterfere } from '../src/overlap.js';
import { CHANNELS_2_4GHZ } from '../src/bands/band-2_4ghz.js';
import { CHANNELS_5GHZ } from '../src/bands/band-5ghz.js';

function ch24(num: number) {
	const found = CHANNELS_2_4GHZ.find((c) => c.number === num);
	if (!found) throw new Error(`Channel ${num} not found`);
	return found;
}

function ch5(num: number) {
	const found = CHANNELS_5GHZ.find((c) => c.number === num);
	if (!found) throw new Error(`Channel ${num} not found`);
	return found;
}

describe('channelsInterfere', () => {
	it('2.4 GHz ch1 and ch6 do NOT interfere at 20 MHz', () => {
		expect(channelsInterfere(ch24(1), ch24(6), 20, 20)).toBe(false);
	});

	it('2.4 GHz ch1 and ch2 DO interfere at 20 MHz', () => {
		expect(channelsInterfere(ch24(1), ch24(2), 20, 20)).toBe(true);
	});

	it('2.4 GHz ch1 and ch5 DO interfere at 20 MHz (within 4)', () => {
		expect(channelsInterfere(ch24(1), ch24(5), 20, 20)).toBe(true);
	});

	it('5 GHz ch36 and ch40 DO interfere at 40 MHz', () => {
		expect(channelsInterfere(ch5(36), ch5(40), 40, 40)).toBe(true);
	});

	it('5 GHz ch36 and ch40 do NOT interfere at 20 MHz', () => {
		expect(channelsInterfere(ch5(36), ch5(40), 20, 20)).toBe(false);
	});

	it('same channel always interferes', () => {
		expect(channelsInterfere(ch24(1), ch24(1), 20, 20)).toBe(true);
		expect(channelsInterfere(ch5(36), ch5(36), 20, 20)).toBe(true);
	});
});
