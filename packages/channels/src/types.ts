export type Band = '2.4ghz' | '5ghz' | '6ghz';

export type ChannelWidth = 20 | 40 | 80 | 160 | 320;

export type RegulatoryDomain = 'fcc' | 'etsi';

export interface Channel {
	number: number;
	frequency: number;
	band: Band;
	dfs: boolean;
	psc: boolean;
	maxWidth: ChannelWidth;
}
