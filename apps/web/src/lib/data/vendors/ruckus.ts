/**
 * Ruckus (CommScope) access point specifications.
 *
 * Sources:
 *   - Ruckus datasheets (see per-model links below)
 *   - Product pages: https://www.ruckusnetworks.com/products/wireless-access-points
 *   - FCC ID prefix: S2M
 *
 * TX power values are aggregate conducted power (dBm) at maximum rate.
 * Ruckus uses adaptive BeamFlex antennas which provide additional effective gain.
 */

import type { ApModel } from '../ap-models.js';

export const RUCKUS_MODELS: readonly ApModel[] = [
	// ─── WiFi 5 (legacy) ────────────────────────────────────────────
	// FCC ID: S2M-R320 | https://webresources.ruckuswireless.com/datasheets/r320/ds-commscope-r320.html
	{
		id: 'ruckus-r320',
		vendor: 'Ruckus',
		model: 'R320',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 20, typicalIndoorRange: 22, streams: 2 }
		]
	},

	// ─── WiFi 6 ─────────────────────────────────────────────────────
	// FCC ID: S2M-R350 | https://webresources.ruckuswireless.com/datasheets/r350/ds-commscope-r350.html
	{
		id: 'ruckus-r350',
		vendor: 'Ruckus',
		model: 'R350',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 }
		]
	},
	// FCC ID: S2M-R550 | https://webresources.ruckuswireless.com/datasheets/r550/ds-commscope-r550.html
	{
		id: 'ruckus-r550',
		vendor: 'Ruckus',
		model: 'R550',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 28, streams: 2 }
		]
	},
	// FCC ID: S2M-R650 | https://webresources.ruckuswireless.com/datasheets/r650/ds-commscope-r650.html
	{
		id: 'ruckus-r650',
		vendor: 'Ruckus',
		model: 'R650',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 27, typicalIndoorRange: 30, streams: 4 }
		]
	},
	// FCC ID: S2M-R750 | https://webresources.ruckuswireless.com/datasheets/r750/ds-commscope-r750.html
	{
		id: 'ruckus-r750',
		vendor: 'Ruckus',
		model: 'R750',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 28, typicalIndoorRange: 35, streams: 4 }
		]
	},
	// FCC ID: S2M-T350 | https://webresources.ruckuswireless.com/datasheets/t350/ds-commscope-t350.html
	{
		id: 'ruckus-t350',
		vendor: 'Ruckus',
		model: 'T350 (Outdoor)',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 35, streams: 2 }
		]
	},

	// ─── WiFi 6E ────────────────────────────────────────────────────
	// FCC ID: S2M-R560 | https://webresources.ruckuswireless.com/datasheets/r560/ds-commscope-r560.html
	{
		id: 'ruckus-r560',
		vendor: 'Ruckus',
		model: 'R560',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 18, streams: 2 }
		]
	},
	// FCC ID: S2M-R760 | https://webresources.ruckuswireless.com/datasheets/r760/ds-commscope-r760.html
	// MIMO: 4x4:4 on all three radios per datasheet (12 spatial streams total)
	{
		id: 'ruckus-r760',
		vendor: 'Ruckus',
		model: 'R760',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 27, typicalIndoorRange: 32, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22, streams: 4 }
		]
	},

	// ─── WiFi 7 ─────────────────────────────────────────────────────
	// FCC ID: S2M-R770 | https://www.ruckusnetworks.com/products/wireless-access-points/r770
	// MIMO: 2x2:2 on 2.4GHz, 4x4:4 on 5GHz, 2x2:2 on 6GHz per datasheet (8 streams total)
	{
		id: 'ruckus-r770',
		vendor: 'Ruckus',
		model: 'R770',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 24, typicalIndoorRange: 20, streams: 2 }
		]
	}
];
