import { describe, it, expect } from 'vitest';
import { getAvailableChannels } from '../src/regulatory.js';

describe('getAvailableChannels', () => {
	it('FCC 2.4 GHz returns 11 channels', () => {
		const channels = getAvailableChannels('2.4ghz', 'fcc');
		expect(channels).toHaveLength(11);
	});

	it('ETSI 2.4 GHz returns 13 channels', () => {
		const channels = getAvailableChannels('2.4ghz', 'etsi');
		expect(channels).toHaveLength(13);
	});

	it('5 GHz without DFS excludes channels 52-64 and 100-144', () => {
		const channels = getAvailableChannels('5ghz', 'fcc');
		const numbers = channels.map((c) => c.number);
		expect(numbers).not.toContain(52);
		expect(numbers).not.toContain(64);
		expect(numbers).not.toContain(100);
		expect(numbers).not.toContain(144);
		expect(numbers).toContain(36);
		expect(numbers).toContain(149);
	});

	it('5 GHz with DFS includes all channels', () => {
		const channels = getAvailableChannels('5ghz', 'fcc', { includeDfs: true });
		expect(channels).toHaveLength(25);
	});
});
