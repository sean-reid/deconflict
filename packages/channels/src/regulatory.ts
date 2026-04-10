import type { Band, Channel, RegulatoryDomain } from './types.js';
import { CHANNELS_2_4GHZ } from './bands/band-2_4ghz.js';
import { CHANNELS_5GHZ } from './bands/band-5ghz.js';
import { CHANNELS_6GHZ } from './bands/band-6ghz.js';

export interface AvailableChannelsOptions {
	includeDfs?: boolean;
}

export function getAvailableChannels(
	band: Band,
	domain: RegulatoryDomain,
	options?: AvailableChannelsOptions
): Channel[] {
	const includeDfs = options?.includeDfs ?? false;

	switch (band) {
		case '2.4ghz': {
			const maxChannel = domain === 'fcc' ? 11 : 13;
			return CHANNELS_2_4GHZ.filter((ch) => ch.number <= maxChannel);
		}
		case '5ghz': {
			if (includeDfs) {
				return [...CHANNELS_5GHZ];
			}
			return CHANNELS_5GHZ.filter((ch) => !ch.dfs);
		}
		case '6ghz': {
			return [...CHANNELS_6GHZ];
		}
	}
}
