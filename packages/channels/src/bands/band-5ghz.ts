import type { Channel, ChannelWidth } from '../types.js';

interface ChannelDef {
	number: number;
	frequency: number;
	dfs: boolean;
	maxWidth: ChannelWidth;
}

const UNII_1: ChannelDef[] = [
	{ number: 36, frequency: 5180, dfs: false, maxWidth: 80 },
	{ number: 40, frequency: 5200, dfs: false, maxWidth: 80 },
	{ number: 44, frequency: 5220, dfs: false, maxWidth: 80 },
	{ number: 48, frequency: 5240, dfs: false, maxWidth: 80 }
];

const UNII_2: ChannelDef[] = [
	{ number: 52, frequency: 5260, dfs: true, maxWidth: 80 },
	{ number: 56, frequency: 5280, dfs: true, maxWidth: 80 },
	{ number: 60, frequency: 5300, dfs: true, maxWidth: 80 },
	{ number: 64, frequency: 5320, dfs: true, maxWidth: 80 }
];

const UNII_2_EXT: ChannelDef[] = [
	{ number: 100, frequency: 5500, dfs: true, maxWidth: 160 },
	{ number: 104, frequency: 5520, dfs: true, maxWidth: 160 },
	{ number: 108, frequency: 5540, dfs: true, maxWidth: 160 },
	{ number: 112, frequency: 5560, dfs: true, maxWidth: 160 },
	{ number: 116, frequency: 5580, dfs: true, maxWidth: 160 },
	{ number: 120, frequency: 5600, dfs: true, maxWidth: 160 },
	{ number: 124, frequency: 5620, dfs: true, maxWidth: 160 },
	{ number: 128, frequency: 5640, dfs: true, maxWidth: 160 },
	{ number: 132, frequency: 5660, dfs: true, maxWidth: 160 },
	{ number: 136, frequency: 5680, dfs: true, maxWidth: 160 },
	{ number: 140, frequency: 5700, dfs: true, maxWidth: 160 },
	{ number: 144, frequency: 5720, dfs: true, maxWidth: 160 }
];

const UNII_3: ChannelDef[] = [
	{ number: 149, frequency: 5745, dfs: false, maxWidth: 80 },
	{ number: 153, frequency: 5765, dfs: false, maxWidth: 80 },
	{ number: 157, frequency: 5785, dfs: false, maxWidth: 80 },
	{ number: 161, frequency: 5805, dfs: false, maxWidth: 80 },
	{ number: 165, frequency: 5825, dfs: false, maxWidth: 20 }
];

const ALL_DEFS: ChannelDef[] = [...UNII_1, ...UNII_2, ...UNII_2_EXT, ...UNII_3];

export const CHANNELS_5GHZ: Channel[] = ALL_DEFS.map((def) => ({
	number: def.number,
	frequency: def.frequency,
	band: '5ghz',
	dfs: def.dfs,
	psc: false,
	maxWidth: def.maxWidth
}));

export const DFS_CHANNELS_5GHZ: number[] = ALL_DEFS.filter((def) => def.dfs).map(
	(def) => def.number
);
