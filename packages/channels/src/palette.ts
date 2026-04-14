import type { Band } from './types.js';

/** All APs use the brand accent color. Channel number labels differentiate. */
export function channelColor(_channelNumber: number, _band: Band): string {
	return '#00d4ff';
}
