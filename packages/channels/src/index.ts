export type { Band, Channel, ChannelWidth, RegulatoryDomain } from './types.js';
export { CHANNELS_2_4GHZ, NON_OVERLAPPING_2_4 } from './bands/band-2_4ghz.js';
export { CHANNELS_5GHZ, DFS_CHANNELS_5GHZ } from './bands/band-5ghz.js';
export { CHANNELS_6GHZ, PSC_CHANNELS_6GHZ } from './bands/band-6ghz.js';
export { channelsInterfere, getFrequencyRange } from './overlap.js';
export { getAvailableChannels } from './regulatory.js';
export { channelColor } from './palette.js';
export type { ThroughputEstimate, ThroughputInput, ThroughputOptions } from './throughput.js';
export { estimateThroughput, getBaseRate } from './throughput.js';
