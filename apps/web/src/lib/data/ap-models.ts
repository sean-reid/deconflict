import type { Band, ChannelWidth } from '@deconflict/channels';
import { UBIQUITI_MODELS } from './vendors/ubiquiti.js';
import { CISCO_MODELS } from './vendors/cisco.js';
import { ARUBA_MODELS } from './vendors/aruba.js';
import { RUCKUS_MODELS } from './vendors/ruckus.js';
import { TPLINK_MODELS } from './vendors/tp-link.js';
import { CONSUMER_MODELS } from './vendors/consumer.js';
import { ENTERPRISE_MODELS } from './vendors/enterprise.js';

export interface ApBandSpec {
	band: Band;
	maxChannelWidth: ChannelWidth;
	maxTxPower: number; // dBm (conducted)
	typicalIndoorRange: number; // meters
}

export interface ApModel {
	id: string;
	vendor: string;
	model: string;
	wifiStandard: string;
	bands: ApBandSpec[];
}

/** All AP models aggregated from per-vendor files. */
export const AP_MODELS: readonly ApModel[] = [
	...UBIQUITI_MODELS,
	...CISCO_MODELS,
	...ARUBA_MODELS,
	...RUCKUS_MODELS,
	...TPLINK_MODELS,
	...CONSUMER_MODELS,
	...ENTERPRISE_MODELS
];

/** Find a model by ID */
export function findModel(id: string): ApModel | undefined {
	return AP_MODELS.find((m) => m.id === id);
}

/** Search models by query (fuzzy match on vendor + model + wifi standard) */
export function searchModels(query: string): ApModel[] {
	if (!query.trim()) return [...AP_MODELS];
	const q = query.toLowerCase();
	return AP_MODELS.filter(
		(m) =>
			m.vendor.toLowerCase().includes(q) ||
			m.model.toLowerCase().includes(q) ||
			m.wifiStandard.toLowerCase().includes(q) ||
			m.id.includes(q)
	);
}

/** Group models by vendor */
export function getModelsByVendor(): Map<string, ApModel[]> {
	const map = new Map<string, ApModel[]>();
	for (const m of AP_MODELS) {
		const list = map.get(m.vendor) ?? [];
		list.push(m);
		map.set(m.vendor, list);
	}
	return map;
}

/** Get the band spec for a model that matches the given band, or the best available */
export function getBandSpec(model: ApModel, preferredBand: Band): ApBandSpec | undefined {
	return model.bands.find((b) => b.band === preferredBand) ?? model.bands[model.bands.length - 1];
}
