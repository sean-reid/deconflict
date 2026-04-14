/**
 * Ubiquiti UniFi access point specifications.
 *
 * Sources:
 *   - Ubiquiti tech specs: https://techspecs.ui.com/unifi/wifi
 *   - FCC ID filings: search SWX prefix at fcc.gov/oet/ea/fccid
 *
 * TX power values are conducted power (dBm) from manufacturer datasheets
 * and verified against FCC test reports where available.
 */

import type { ApModel } from '../ap-models.js';

export const UBIQUITI_MODELS: readonly ApModel[] = [
	// ─── WiFi 5 (legacy) ────────────────────────────────────────────
	// FCC ID: SWX-UAPACL | https://techspecs.ui.com/unifi/wifi/uap-ac-lite
	{
		id: 'ubiquiti-uap-ac-lite',
		vendor: 'Ubiquiti',
		model: 'UAP-AC-Lite',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 20, typicalIndoorRange: 20, streams: 2 }
		]
	},
	// FCC ID: SWX-UAPACPRO | https://techspecs.ui.com/unifi/wifi/uap-ac-pro
	{
		id: 'ubiquiti-uap-ac-pro',
		vendor: 'Ubiquiti',
		model: 'UAP-AC-Pro',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 35, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 22, typicalIndoorRange: 25, streams: 3 }
		]
	},
	// FCC ID: SWX-UAPACHD | https://techspecs.ui.com/unifi/wifi/uap-ac-hd
	{
		id: 'ubiquiti-uap-ac-hd',
		vendor: 'Ubiquiti',
		model: 'UAP-AC-HD',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 }, // 4x4 MU-MIMO per techspecs.ui.com/unifi/wifi/uap-ac-hd
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 }
		]
	},
	// FCC ID: SWX-UAPNANOHD | https://techspecs.ui.com/unifi/wifi/uap-nanohd
	{
		id: 'ubiquiti-uap-nanohd',
		vendor: 'Ubiquiti',
		model: 'UAP-nanoHD',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 25, streams: 4 }
		]
	},

	// ─── WiFi 6 ─────────────────────────────────────────────────────
	// FCC ID: SWX-U6LITE | https://techspecs.ui.com/unifi/wifi/u6-lite
	{
		id: 'ubiquiti-u6-lite',
		vendor: 'Ubiquiti',
		model: 'U6 Lite',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// FCC ID: SWX-U6P | https://techspecs.ui.com/unifi/wifi/u6-plus
	{
		id: 'ubiquiti-u6-plus',
		vendor: 'Ubiquiti',
		model: 'U6+',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// FCC ID: SWX-U6PRO | https://techspecs.ui.com/unifi/wifi/u6-pro
	{
		id: 'ubiquiti-u6-pro',
		vendor: 'Ubiquiti',
		model: 'U6 Pro',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// FCC ID: SWX-U6LR | https://techspecs.ui.com/unifi/wifi/u6-lr
	{
		id: 'ubiquiti-u6-lr',
		vendor: 'Ubiquiti',
		model: 'U6 LR',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 45, streams: 4 }, // 4x4 SU-MIMO per techspecs.ui.com/unifi/wifi/u6-lr
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 35, streams: 4 }
		]
	},
	// FCC ID: SWX-U6MESH | https://techspecs.ui.com/unifi/wifi/u6-mesh
	{
		id: 'ubiquiti-u6-mesh',
		vendor: 'Ubiquiti',
		model: 'U6 Mesh',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 25, streams: 4 } // 4x4 DL/UL MU-MIMO per techspecs.ui.com/unifi/wifi/u6-mesh
		]
	},
	// FCC ID: SWX-U6IW | https://techspecs.ui.com/unifi/wifi/u6-iw
	{
		id: 'ubiquiti-u6-in-wall',
		vendor: 'Ubiquiti',
		model: 'U6 In-Wall',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 20, streams: 4 }
		]
	},
	// FCC ID: SWX-U6EXT | https://techspecs.ui.com/unifi/wifi/u6-extender
	{
		id: 'ubiquiti-u6-extender',
		vendor: 'Ubiquiti',
		model: 'U6 Extender',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 18, streams: 4 } // 4x4 DL/UL MU-MIMO per techspecs.ui.com/unifi/wifi/u6-extender
		]
	},

	// ─── WiFi 6E ────────────────────────────────────────────────────
	// FCC ID: SWX-U6EP | https://techspecs.ui.com/unifi/wifi/u6-enterprise
	{
		id: 'ubiquiti-u6-enterprise',
		vendor: 'Ubiquiti',
		model: 'U6 Enterprise',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 18, streams: 4 }
		]
	},
	// FCC ID: SWX-U6EPIW | https://techspecs.ui.com/unifi/wifi/u6-enterprise-iw
	{
		id: 'ubiquiti-u6-enterprise-iw',
		vendor: 'Ubiquiti',
		model: 'U6 Enterprise In-Wall',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 20, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 15, streams: 4 }
		]
	},

	// ─── WiFi 7 ─────────────────────────────────────────────────────
	// FCC ID: SWX-U7PRO | https://techspecs.ui.com/unifi/wifi/u7-pro
	{
		id: 'ubiquiti-u7-pro',
		vendor: 'Ubiquiti',
		model: 'U7 Pro',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 28, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 18, streams: 2 }
		]
	},
	// FCC ID: SWX-U7PROM | https://techspecs.ui.com/unifi/wifi/u7-pro-max
	{
		id: 'ubiquiti-u7-pro-max',
		vendor: 'Ubiquiti',
		model: 'U7 Pro Max',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 40, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 29, typicalIndoorRange: 32, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 20, streams: 2 } // 2x2 DL/UL MU-MIMO per techspecs.ui.com/unifi/wifi/u7-pro-max
		]
	},
	// FCC ID: SWX-U7PROW | https://techspecs.ui.com/unifi/wifi/u7-pro-wall
	{
		id: 'ubiquiti-u7-pro-wall',
		vendor: 'Ubiquiti',
		model: 'U7 Pro Wall',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 22, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 15, streams: 2 }
		]
	}
];
