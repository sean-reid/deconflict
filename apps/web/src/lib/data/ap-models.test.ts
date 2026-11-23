import { describe, expect, it } from 'vitest';
import type { ApBandSpec } from './ap-models.js';
import { AP_MODELS, findModel, getBandSpec } from './ap-models.js';

const MAX_WIDTH: Record<ApBandSpec['band'], number> = { '2.4ghz': 40, '5ghz': 160, '6ghz': 320 };

const b24 = (maxTxPower: number, streams: number, typicalIndoorRange: number): ApBandSpec => ({
	band: '2.4ghz',
	maxChannelWidth: 40,
	maxTxPower,
	typicalIndoorRange,
	streams
});
const b5 = (maxTxPower: number, streams: number, typicalIndoorRange: number): ApBandSpec => ({
	band: '5ghz',
	maxChannelWidth: 160,
	maxTxPower,
	typicalIndoorRange,
	streams
});
const b6 = (maxTxPower: number, streams: number, typicalIndoorRange: number): ApBandSpec => ({
	band: '6ghz',
	maxChannelWidth: 320,
	maxTxPower,
	typicalIndoorRange,
	streams
});

// Values from techspecs.ui.com (Max. TX Power, MIMO); 240 MHz on 5 GHz is stored as 160.
const UBIQUITI_WIFI7: [id: string, model: string, bands: ApBandSpec[]][] = [
	['ubiquiti-u7-lite', 'U7 Lite', [b24(23, 2, 30), b5(24, 2, 22)]],
	['ubiquiti-u7-lr', 'U7 Long-Range', [b24(26, 2, 45), b5(27, 3, 35)]],
	['ubiquiti-u7-pro-xg', 'U7 Pro XG', [b24(23, 2, 35), b5(26, 2, 28), b6(24, 2, 18)]],
	['ubiquiti-u7-pro-xgs', 'U7 Pro XGS', [b24(23, 2, 40), b5(29, 4, 32), b6(24, 2, 20)]],
	['ubiquiti-u7-pro-xg-wall', 'U7 Pro XG Wall', [b24(23, 2, 28), b5(26, 2, 22), b6(24, 2, 15)]],
	['ubiquiti-u7-in-wall', 'U7 In-Wall', [b24(23, 2, 25), b5(24, 2, 20)]],
	['ubiquiti-u7-mesh', 'U7 Mesh', [b24(23, 2, 30), b5(24, 2, 25)]],
	['ubiquiti-u7-outdoor', 'U7 Outdoor', [b24(23, 2, 40), b5(26, 2, 32)]],
	['ubiquiti-u7-pro-outdoor', 'U7 Pro Outdoor', [b24(23, 2, 40), b5(26, 2, 32), b6(26, 2, 22)]],
	['ubiquiti-u7-industrial', 'U7 Industrial', [b24(23, 2, 40), b5(24, 2, 30)]],
	['ubiquiti-e7', 'E7', [b24(23, 2, 40), b5(30, 4, 35), b6(24, 4, 22)]],
	['ubiquiti-e7-campus', 'E7 Campus', [b24(23, 2, 45), b5(30, 4, 38), b6(30, 4, 25)]],
	['ubiquiti-e7-campus-indoor', 'E7 Campus Indoor', [b24(23, 2, 45), b5(30, 4, 38), b6(30, 4, 25)]],
	['ubiquiti-e7-audience', 'E7 Audience', [b5(30, 4, 38), b6(30, 4, 25)]],
	['ubiquiti-e7-audience-indoor', 'E7 Audience Indoor', [b5(30, 4, 38), b6(30, 4, 25)]]
];

describe('AP model catalog', () => {
	it('has unique model ids', () => {
		const ids = AP_MODELS.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('has no repeated band within a model', () => {
		for (const m of AP_MODELS) {
			const bands = m.bands.map((b) => b.band);
			expect(new Set(bands).size, m.id).toBe(bands.length);
		}
	});

	it('keeps channel widths within band limits', () => {
		for (const m of AP_MODELS) {
			for (const b of m.bands) {
				expect(b.maxChannelWidth, `${m.id} ${b.band}`).toBeLessThanOrEqual(MAX_WIDTH[b.band]);
			}
		}
	});

	it.each(UBIQUITI_WIFI7)('%s matches the Ubiquiti datasheet', (id, model, bands) => {
		const m = findModel(id);
		expect(m).toBeDefined();
		expect(m?.vendor).toBe('Ubiquiti');
		expect(m?.model).toBe(model);
		expect(m?.wifiStandard).toBe('WiFi 7');
		expect(m?.bands).toEqual(bands);
	});

	it('falls back to the last band for models without 2.4 GHz', () => {
		const m = findModel('ubiquiti-e7-audience');
		expect(m).toBeDefined();
		expect(getBandSpec(m!, '2.4ghz')?.band).toBe('6ghz');
	});
});
