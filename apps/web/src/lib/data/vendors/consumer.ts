/**
 * Consumer WiFi router and mesh specifications.
 * Covers: Netgear, ASUS, Google, eero, Linksys, Apple, Sonos.
 *
 * Sources:
 *   - Netgear datasheets: https://www.netgear.com/support
 *   - ASUS tech specs: https://www.asus.com/networking-iot-servers
 *   - Google support: https://support.google.com/googlenest/answer/6280668
 *   - eero product pages: https://eero.com/shop
 *   - Linksys product pages: https://www.linksys.com
 *   - Apple support: https://support.apple.com/en-us/112419
 *   - Dong Knows Tech reviews (TX power verification): https://dongknows.com
 *
 * Consumer devices often publish EIRP rather than conducted power.
 * Values below are best-estimate conducted power from FCC filings,
 * datasheets, and reviewer measurements.
 */

import type { ApModel } from '../ap-models.js';

export const CONSUMER_MODELS: readonly ApModel[] = [
	// ─── Netgear (legacy) ────────────────────────────────────────────
	// https://www.netgear.com/home/wifi/routers/r6700ax/
	// 3x3:3 MIMO on both bands -- https://www.netgear.com/images/datasheet/networking/wifirouter/r6700.pdf
	{
		id: 'netgear-r6700',
		vendor: 'Netgear',
		model: 'Nighthawk R6700',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 25, streams: 3 }
		]
	},
	// https://www.netgear.com/home/wifi/routers/r7000/
	// 3x3:3 MIMO on both bands -- https://www.downloads.netgear.com/files/GDC/datasheet/en/R7000.pdf
	{
		id: 'netgear-r7000',
		vendor: 'Netgear',
		model: 'Nighthawk R7000',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 35, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 24, typicalIndoorRange: 28, streams: 3 }
		]
	},

	// ─── Netgear (current) ───────────────────────────────────────────
	// https://www.downloads.netgear.com/files/GDC/WAX620/WAX620_DS.pdf
	// 4x4 on both bands, 8 streams total -- https://dongknows.com/netgear-wax620-ax3600-poe-access-point-now-available/
	{
		id: 'netgear-wax620',
		vendor: 'Netgear',
		model: 'WAX620 (Business)',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// https://www.downloads.netgear.com/files/GDC/WAX630/WAX630_DS.pdf
	// 4x4 tri-band, 12 streams total -- https://www.netguardstore.com/wax630.asp
	{
		id: 'netgear-wax630',
		vendor: 'Netgear',
		model: 'WAX630 (Business)',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 }
		]
	},
	// https://www.downloads.netgear.com/files/GDC/WAX630E/WAX630E_DS.pdf
	// 2x2 2.4GHz, 4x4 5GHz, 2x2 6GHz -- https://dongknows.com/netgear-wax630e-poe-wi-fi-6e-access-point-review/
	{
		id: 'netgear-wax630e',
		vendor: 'Netgear',
		model: 'WAX630E (Business)',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// https://www.downloads.netgear.com/files/GDC/RAX50/RAX50_DS.pdf
	// 2x2 2.4GHz, 4x4 5GHz (6-stream total) -- https://dongknows.com/netgear-rax50-nighthawk-ax6-wi-fi-6-router-review/
	{
		id: 'netgear-rax50',
		vendor: 'Netgear',
		model: 'Nighthawk RAX50',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 }
		]
	},
	// https://www.netgear.com/ca-en/home/wifi/routers/raxe500/
	// 4x4 on all bands, 12 streams total -- https://dongknows.com/netgear-nighthawk-raxe500-wi-fi-6e-router-review/
	{
		id: 'netgear-raxe500',
		vendor: 'Netgear',
		model: 'Nighthawk RAXE500',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22, streams: 4 }
		]
	},
	// FCC ID: PY323100586 | https://www.netgear.com/home/wifi/routers/rs700s/
	// 4x4 on all bands, 12 streams total -- https://www.downloads.netgear.com/files/GDC/RS700S/RS700S_TS.pdf
	{
		id: 'netgear-rs700s',
		vendor: 'Netgear',
		model: 'Nighthawk RS700S',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 22, streams: 4 }
		]
	},
	// https://www.netgear.com/home/wifi/mesh/rbe972s/
	// 4x4 on all bands, 16 streams total -- https://dongknows.com/netgear-orbi-rbke960-quad-band-wi-fi-6e-mesh-review/
	{
		id: 'netgear-orbi-rbke963',
		vendor: 'Netgear',
		model: 'Orbi RBKE963',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	},
	// https://www.netgear.com/home/wifi/mesh/rbe972s/
	// 4x4 on all bands, 16 streams total -- https://dongknows.com/netgear-orbi-970-series-wi-fi-7-mesh-review/
	{
		id: 'netgear-orbi-rbe972',
		vendor: 'Netgear',
		model: 'Orbi RBE972',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 20, streams: 4 }
		]
	},

	// ─── ASUS (legacy) ──────────────────────────────────────────────
	// https://www.asus.com/networking-iot-servers/wifi-routers/asus-wifi-routers/rt-ac68u/techspec/
	// 3x3:3 MIMO on both bands -- https://dlcdnet.asus.com/pub/ASUS/wireless/RT-AC68U/E14013_RT-AC68U_manual_v2.pdf
	{
		id: 'asus-rt-ac68u',
		vendor: 'ASUS',
		model: 'RT-AC68U',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 32, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 22, typicalIndoorRange: 25, streams: 3 }
		]
	},
	// https://www.asus.com/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-ac88u/techspec/
	// 4x4 MIMO on both bands -- https://dongknows.com/asus-rt-ac88u-review/
	{
		id: 'asus-rt-ac88u',
		vendor: 'ASUS',
		model: 'RT-AC88U',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 24, typicalIndoorRange: 28, streams: 4 }
		]
	},

	// ─── ASUS (current) ─────────────────────────────────────────────
	// https://www.asus.com/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-ax86u/techspec/
	// 3x3 2.4GHz (BCM6710), 4x4 5GHz (BCM43684) -- https://techinfodepot.shoutwiki.com/wiki/ASUS_RT-AX86U
	{
		id: 'asus-rt-ax86u',
		vendor: 'ASUS',
		model: 'RT-AX86U',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// https://www.asus.com/us/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-ax86u-pro/techspec/
	// 3x3 2.4GHz, 4x4 5GHz -- https://www.asus.com/us/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-ax86u-pro/techspec/
	{
		id: 'asus-rt-ax86u-pro',
		vendor: 'ASUS',
		model: 'RT-AX86U Pro',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// https://www.asus.com/us/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-ax88u-pro/techspec/
	// 4x4 MIMO on both bands -- https://dongknows.com/asus-rt-ax88u-pro-review/
	{
		id: 'asus-rt-ax88u-pro',
		vendor: 'ASUS',
		model: 'RT-AX88U Pro',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// https://www.asus.com/networking-iot-servers/whole-home-mesh-wifi-system/zenwifi-wifi-systems/asus-zenwifi-et8/
	// 2x2 2.4GHz, 2x2 5GHz, 4x4 6GHz -- https://dongknows.com/asus-zenwifi-et8-wi-fi-6e-mesh-system-review/
	{
		id: 'asus-zenwifi-et8',
		vendor: 'ASUS',
		model: 'ZenWiFi ET8',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	},
	// https://rog.asus.com/networking/rog-rapture-gt-axe16000-model/spec/
	// 4x4 on all bands, 16 streams total -- https://techinfodepot.shoutwiki.com/wiki/ASUS_GT-AXE16000
	{
		id: 'asus-gt-axe16000',
		vendor: 'ASUS',
		model: 'GT-AXE16000',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22, streams: 4 }
		]
	},
	// https://www.asus.com/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-be96u/techspec/
	// 4x4 on all bands, 12 streams total -- https://dongknows.com/asus-rt-be96u-be19000-tri-band-wi-fi-7-router-review/
	{
		id: 'asus-rt-be96u',
		vendor: 'ASUS',
		model: 'RT-BE96U',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 20, streams: 4 }
		]
	},
	// https://dongknows.com/asus-rt-be88u-dual-band-wi-fi-7-router-review/
	// 4x4 on both bands -- https://techinfodepot.shoutwiki.com/wiki/ASUS_RT-BE88U
	{
		id: 'asus-rt-be88u',
		vendor: 'ASUS',
		model: 'RT-BE88U',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 38, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// https://www.asus.com/networking-iot-servers/whole-home-mesh-wifi-system/zenwifi-wifi-systems/asus-zenwifi-bq16/techspec/
	// 4x4 on all bands -- https://dongknows.com/asus-asus-zenwifi-bq16-pro-review/
	{
		id: 'asus-zenwifi-bq16',
		vendor: 'ASUS',
		model: 'ZenWiFi BQ16',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 20, streams: 4 }
		]
	},
	// https://www.asus.com/networking-iot-servers/business-network-solutions/asus-expertwifi/asus-expertwifi-ebr63/techspec/
	{
		id: 'asus-expertwifi-ebr63',
		vendor: 'ASUS',
		model: 'ExpertWiFi EBR63',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 30, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 22, streams: 2 }
		]
	},

	// ─── Google ──────────────────────────────────────────────────────
	// https://support.google.com/googlenest/answer/6280668
	// AC2200: 2x2 2.4GHz, 4x4 5GHz -- https://support.google.com/googlenest/answer/6280668
	{
		id: 'google-nest-wifi',
		vendor: 'Google',
		model: 'Nest WiFi',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 19, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 19, typicalIndoorRange: 20, streams: 4 }
		]
	},
	// https://support.google.com/googlenest/answer/6280668
	{
		id: 'google-nest-wifi-pro',
		vendor: 'Google',
		model: 'Nest WiFi Pro',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 19, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 19, typicalIndoorRange: 20, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 19, typicalIndoorRange: 15, streams: 2 }
		]
	},

	// ─── Amazon eero ─────────────────────────────────────────────────
	// https://eero.com/shop/eero-pro-6
	{
		id: 'eero-pro-6',
		vendor: 'eero',
		model: 'Pro 6',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 25, streams: 2 }
		]
	},
	// https://eero.com/shop/eero-6-plus
	{
		id: 'eero-6-plus',
		vendor: 'eero',
		model: '6+',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 20, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// https://eero.com/shop/eero-pro-6e
	{
		id: 'eero-pro-6e',
		vendor: 'eero',
		model: 'Pro 6E',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 25, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 18, streams: 2 }
		]
	},
	// FCC ID: 2AEM4-231770 | https://eero.com/shop/eero-max-7
	// 2x2 2.4GHz, 4x4 5GHz, 4x4 6GHz (10 streams total) -- https://www.snapav.com/wcsstore/ExtendedSitesCatalogAssetStore/attachments/documents/Networking/Cutsheets/eero%20eeroMax7_Fact_Sheet_Street.pdf
	{
		id: 'eero-max-7',
		vendor: 'eero',
		model: 'Max 7',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 28, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 23, typicalIndoorRange: 20, streams: 4 }
		]
	},

	// ─── Linksys (legacy) ───────────────────────────────────────────
	// Linksys WRT1900AC — discontinued, specs from FCC ID PY314300284
	// 3x3:3 MIMO on both bands -- https://techinfodepot.shoutwiki.com/wiki/Linksys_WRT1900AC_v2
	{
		id: 'linksys-wrt1900ac',
		vendor: 'Linksys',
		model: 'WRT1900AC',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 32, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 22, typicalIndoorRange: 25, streams: 3 }
		]
	},
	// Linksys EA7500 — discontinued, specs from FCC ID Q87-EA7500
	// 3x3 MIMO on both bands (QCA9983/QCA9982) -- https://www.smallnetbuilder.com/wireless/wireless-reviews/linksys-ea7500-max-stream-ac1900-mu-mimo-gigabit-router-reviewed/
	{
		id: 'linksys-ea7500',
		vendor: 'Linksys',
		model: 'EA7500',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 20, typicalIndoorRange: 22, streams: 3 }
		]
	},

	// ─── Linksys (current) ──────────────────────────────────────────
	// https://www.linksys.com/mx5300---tri-band-ax5300-mesh-wifi-6-router/MX5300.html
	// 4x4 on all bands, 12 streams total -- https://dongknows.com/linksys-mx5300-mx10-wi-fi-6-mesh-system-review/
	{
		id: 'linksys-velop-mx5300',
		vendor: 'Linksys',
		model: 'Velop MX5300',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 32, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 25, streams: 4 }
		]
	},
	// https://www.linksys.com/us/whole-home-mesh-wifi/linksys-atlas-pro-6-dual-band-mesh-wifi-6-system-3-pack/p/p-mx5503/
	{
		id: 'linksys-atlas-pro-6',
		vendor: 'Linksys',
		model: 'Atlas Pro 6',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 25, streams: 2 }
		]
	},
	// https://dongknows.com/linksys-atlas-max-6e-axe8400-mx8503-review/
	// 4x4 on all bands, 12 streams total -- https://dongknows.com/linksys-atlas-max-6e-axe8400-mx8503-review/
	{
		id: 'linksys-atlas-max-6e',
		vendor: 'Linksys',
		model: 'Atlas Max 6E',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 32, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 25, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 18, streams: 4 }
		]
	},
	// https://dongknows.com/linksys-mr7500-hydra-pro-6e-router-review/
	// 2x2 2.4GHz, 2x2 5GHz, 4x4 6GHz -- https://www.smallnetbuilder.com/wireless/wireless-reviews/linksys-mr7500-hydra-pro-6e-reviewed/
	{
		id: 'linksys-hydra-pro-6e',
		vendor: 'Linksys',
		model: 'Hydra Pro 6E',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 22, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	},

	// ─── Apple (discontinued) ───────────────────────────────────────
	// https://support.apple.com/en-us/112419
	{
		id: 'apple-airport-express',
		vendor: 'Apple',
		model: 'AirPort Express',
		wifiStandard: 'WiFi 4',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 18, typicalIndoorRange: 25, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 15, streams: 2 }
		]
	},
	// https://support.apple.com/en-us/112419
	// 3x3:3 MIMO on both bands (6 antennas total) -- https://support.apple.com/en-us/112419
	{
		id: 'apple-airport-extreme',
		vendor: 'Apple',
		model: 'AirPort Extreme',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35, streams: 3 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 25, streams: 3 }
		]
	}
];
