/**
 * TP-Link access point and router specifications (Omada + consumer).
 *
 * Sources:
 *   - Omada product pages: https://www.omadanetworks.com
 *   - FCC filings: search 2AXJ4 prefix at fcc.gov/oet/ea/fccid
 *   - Datasheets: search at https://www.tp-link.com/us/support/download/
 *   - TP-Link product pages: https://www.tp-link.com
 *
 * TX power values are conducted power (dBm) from FCC test reports where
 * available; otherwise estimated from device class and FCC EIRP limits.
 */

import type { ApModel } from '../ap-models.js';

export const TPLINK_MODELS: readonly ApModel[] = [
	// ─── Omada (business) ───────────────────────────────────────────
	// FCC ID: 2AXJ4EAP610 | https://www.tp-link.com/baltic/business-networking/omada-sdn-access-point/eap610/
	{
		id: 'tplink-eap610',
		vendor: 'TP-Link',
		model: 'EAP610',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 20, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22 }
		]
	},
	// https://www.wifi-stock.com/details/tp-link-ax1800-wireless-dual-band-ceiling-mount-access-point-eap620-hd-eap620hd.html
	{
		id: 'tplink-eap620-hd',
		vendor: 'TP-Link',
		model: 'EAP620 HD',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 25, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 25 }
		]
	},
	// FCC ID: 2AXJ4EAP650 | https://www.omadanetworks.com/us/business-networking/omada-wifi-ceiling-mount/eap650/
	{
		id: 'tplink-eap650',
		vendor: 'TP-Link',
		model: 'EAP650',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 28 }
		]
	},
	// https://static.tp-link.com/upload/product-overview/2025/202509/20250922/Datasheet_EAP670%202.20.pdf
	{
		id: 'tplink-eap670',
		vendor: 'TP-Link',
		model: 'EAP670',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 28, typicalIndoorRange: 32 }
		]
	},
	// https://www.omadanetworks.com/ae/business-networking/omada-wifi-ceiling-mount/eap680/
	{
		id: 'tplink-eap680',
		vendor: 'TP-Link',
		model: 'EAP680',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 38 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 }
		]
	},
	// FCC ID: 2AXJ4EAP690EHD | https://www.omadanetworks.com/us/business-networking/omada-wifi-ceiling-mount/eap690e-hd/
	{
		id: 'tplink-eap690e',
		vendor: 'TP-Link',
		model: 'EAP690E HD',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 28, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 28, typicalIndoorRange: 32 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22 }
		]
	},

	// ─── Consumer (legacy WiFi 5) ───────────────────────────────────
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-c7/
	{
		id: 'tplink-archer-c7',
		vendor: 'TP-Link',
		model: 'Archer C7',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-a7/
	{
		id: 'tplink-archer-a7',
		vendor: 'TP-Link',
		model: 'Archer A7',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-c9/
	{
		id: 'tplink-archer-c9',
		vendor: 'TP-Link',
		model: 'Archer C9',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 25 }
		]
	},

	// ─── Consumer (WiFi 6+) ─────────────────────────────────────────
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-ax21/
	{
		id: 'tplink-archer-ax21',
		vendor: 'TP-Link',
		model: 'Archer AX21',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-ax55/
	{
		id: 'tplink-archer-ax55',
		vendor: 'TP-Link',
		model: 'Archer AX55',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 32 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-ax73/
	{
		id: 'tplink-archer-ax73',
		vendor: 'TP-Link',
		model: 'Archer AX73',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 32 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25 }
		]
	},
	// FCC ID: 2AXJ4XE200 | https://www.tp-link.com/us/deco-mesh-wifi/product-family/deco-xe200/
	{
		id: 'tplink-deco-xe200',
		vendor: 'TP-Link',
		model: 'Deco XE200',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 22 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 16 }
		]
	},
	// https://www.tp-link.com/us/deco-mesh-wifi/product-family/deco-be65/
	{
		id: 'tplink-deco-be65',
		vendor: 'TP-Link',
		model: 'Deco BE65',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 25 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 18 }
		]
	},
	// FCC ID: 2AXJ4BE900 | https://www.tp-link.com/us/home-networking/wifi-router/archer-be900/
	{
		id: 'tplink-archer-be900',
		vendor: 'TP-Link',
		model: 'Archer BE900',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 20 }
		]
	}
];
