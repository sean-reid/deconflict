import type { Channel, ChannelWidth } from './types.js';

export function getFrequencyRange(ch: Channel, width: ChannelWidth): { low: number; high: number } {
	return {
		low: ch.frequency - width / 2,
		high: ch.frequency + width / 2
	};
}

export function channelsInterfere(
	a: Channel,
	b: Channel,
	widthA: ChannelWidth,
	widthB: ChannelWidth
): boolean {
	if (a.band !== b.band) {
		return false;
	}

	if (a.number === b.number) {
		return true;
	}

	if (a.band === '2.4ghz' && widthA === 20 && widthB === 20) {
		return Math.abs(a.number - b.number) < 5;
	}

	const rangeA = getFrequencyRange(a, widthA);
	const rangeB = getFrequencyRange(b, widthB);

	return rangeA.low < rangeB.high && rangeB.low < rangeA.high;
}
