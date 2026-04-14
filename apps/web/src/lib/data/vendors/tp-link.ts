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
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 20, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// https://www.wifi-stock.com/details/tp-link-ax1800-wireless-dual-band-ceiling-mount-access-point-eap620-hd-eap620hd.html
	{
		id: 'tplink-eap620-hd',
		vendor: 'TP-Link',
		model: 'EAP620 HD',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 25, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 25, streams: 4 }
		]
	},
	// FCC ID: 2AXJ4EAP650 | https://www.omadanetworks.com/us/business-networking/omada-wifi-ceiling-mount/eap650/
	{
		id: 'tplink-eap650',
		vendor: 'TP-Link',
		model: 'EAP650',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 28, streams: 2 }
		]
	},
	// https://static.tp-link.com/upload/product-overview/2025/202509/20250922/Datasheet_EAP670%202.20.pdf
	{
		id: 'tplink-eap670',
		vendor: 'TP-Link',
		model: 'EAP670',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 28, typicalIndoorRange: 32, streams: 4 }
		]
	},
	// https://www.omadanetworks.com/ae/business-networking/omada-wifi-ceiling-mount/eap680/
	// 4x4 on both bands (1148Mbps 2.4GHz + 4804Mbps 5GHz) -- https://www.hellasdigital.gr/networking-el/wireless-el/indoor-ap-el/wifi-6/tp-link-eap680-v1-0-wifi-6-4x4dbi-20dbm-1148mbps-4x4-2-4ghz-and-4x5dbi-28dbm-4804mbps-4x4-5ghz-1x2-5gbe-12v-and-802-3at/
	{
		id: 'tplink-eap680',
		vendor: 'TP-Link',
		model: 'EAP680',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30, streams: 4 }
		]
	},
	// FCC ID: 2AXJ4EAP690EHD | https://www.omadanetworks.com/us/business-networking/omada-wifi-ceiling-mount/eap690e-hd/
	// 4x4 on all bands (quad-band, 12+ streams) -- https://www.itpro.com/hardware/routers/tp-link-omada-eap690e-hd-review
	{
		id: 'tplink-eap690e',
		vendor: 'TP-Link',
		model: 'EAP690E HD',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 28, typicalIndoorRange: 40, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 28, typicalIndoorRange: 32, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22, streams: 4 }
		]
	},

	// ─── Consumer (legacy WiFi 5) ───────────────────────────────────
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-c7/
	// 3x3:3 MIMO on both bands (QCA9558 SoC) -- https://techinfodepot.shoutwiki.com/wiki/TP-LINK_Archer_C7_v2.x
	{
		id: 'tplink-archer-c7',
		vendor: 'TP-Link',
		model: 'Archer C7',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 3 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-a7/
	// 3x3:3 MIMO on both bands -- https://www.topcpu.net/en/cpu/tplink-archer-a7-v5
	{
		id: 'tplink-archer-a7',
		vendor: 'TP-Link',
		model: 'Archer A7',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 3 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-c9/
	// 3x3:3 MIMO on both bands -- https://static.tp-link.com/res/down/doc/Archer_C9_Datasheet_2.0_UN.pdf
	{
		id: 'tplink-archer-c9',
		vendor: 'TP-Link',
		model: 'Archer C9',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 25, streams: 3 }
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
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-ax55/
	{
		id: 'tplink-archer-ax55',
		vendor: 'TP-Link',
		model: 'Archer AX55',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 2 }
		]
	},
	// https://www.tp-link.com/us/home-networking/wifi-router/archer-ax73/
	// 2x2 2.4GHz (BCM6750), 4x4 5GHz (BCM43684) -- https://dongknows.com/tp-link-archer-ax73-ax5400-router-review/
	{
		id: 'tplink-archer-ax73',
		vendor: 'TP-Link',
		model: 'Archer AX73',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 }
		]
	},
	// FCC ID: 2AXJ4XE200 | https://www.tp-link.com/us/deco-mesh-wifi/product-family/deco-xe200/
	// 4x4 per band, 16 streams total -- https://dongknows.com/tp-link-deco-xe200-axe11000-mesh-system-review/
	{
		id: 'tplink-deco-xe200',
		vendor: 'TP-Link',
		model: 'Deco XE200',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 22, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 16, streams: 4 }
		]
	},
	// https://www.tp-link.com/us/deco-mesh-wifi/product-family/deco-be65/
	{
		id: 'tplink-deco-be65',
		vendor: 'TP-Link',
		model: 'Deco BE65',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 25, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 18, streams: 2 }
		]
	},
	// FCC ID: 2AXJ4BE900 | https://www.tp-link.com/us/home-networking/wifi-router/archer-be900/
	// 4x4 per band, 16 streams total (quad-band) -- https://static.tp-link.com/upload/product-overview/2023/202312/20231222/Archer%20BE900%202.0_Datasheet.pdf
	{
		id: 'tplink-archer-be900',
		vendor: 'TP-Link',
		model: 'Archer BE900',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 20, streams: 4 }
		]
	}
];
