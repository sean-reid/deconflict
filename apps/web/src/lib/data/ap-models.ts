import type { Band, ChannelWidth } from '@deconflict/channels';

export interface ApBandSpec {
	band: Band;
	maxChannelWidth: ChannelWidth;
	maxTxPower: number; // dBm
	typicalIndoorRange: number; // meters
}

export interface ApModel {
	id: string;
	vendor: string;
	model: string;
	wifiStandard: string;
	bands: ApBandSpec[];
}

export const AP_MODELS: readonly ApModel[] = [
	// ─── Ubiquiti UniFi ──────────────────────────────────────────────
	{
		id: 'ubiquiti-u6-lite',
		vendor: 'Ubiquiti',
		model: 'U6 Lite',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 25 }
		]
	},
	{
		id: 'ubiquiti-u6-pro',
		vendor: 'Ubiquiti',
		model: 'U6 Pro',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'ubiquiti-u6-lr',
		vendor: 'Ubiquiti',
		model: 'U6 LR',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 50 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 40 }
		]
	},
	{
		id: 'ubiquiti-u6-enterprise',
		vendor: 'Ubiquiti',
		model: 'U6 Enterprise',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 20 }
		]
	},
	{
		id: 'ubiquiti-u7-pro',
		vendor: 'Ubiquiti',
		model: 'U7 Pro',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 24, typicalIndoorRange: 20 }
		]
	},

	// ─── Cisco Meraki ────────────────────────────────────────────────
	{
		id: 'meraki-mr36',
		vendor: 'Cisco Meraki',
		model: 'MR36',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 25 }
		]
	},
	{
		id: 'meraki-mr46',
		vendor: 'Cisco Meraki',
		model: 'MR46',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'meraki-mr56',
		vendor: 'Cisco Meraki',
		model: 'MR56',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 45 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 35 }
		]
	},
	{
		id: 'meraki-mr57',
		vendor: 'Cisco Meraki',
		model: 'MR57',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 20 }
		]
	},

	// ─── Aruba (HPE) ─────────────────────────────────────────────────
	{
		id: 'aruba-ap505',
		vendor: 'Aruba',
		model: 'AP-505',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 25 }
		]
	},
	{
		id: 'aruba-ap535',
		vendor: 'Aruba',
		model: 'AP-535',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'aruba-ap635',
		vendor: 'Aruba',
		model: 'AP-635',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 20 }
		]
	},

	// ─── Ruckus ──────────────────────────────────────────────────────
	{
		id: 'ruckus-r350',
		vendor: 'Ruckus',
		model: 'R350',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 25 }
		]
	},
	{
		id: 'ruckus-r550',
		vendor: 'Ruckus',
		model: 'R550',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 25, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'ruckus-r750',
		vendor: 'Ruckus',
		model: 'R750',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 45 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 35 }
		]
	},
	{
		id: 'ruckus-r770',
		vendor: 'Ruckus',
		model: 'R770',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 45 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 35 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 25 }
		]
	},

	// ─── TP-Link Omada ───────────────────────────────────────────────
	{
		id: 'tplink-eap610',
		vendor: 'TP-Link',
		model: 'EAP610',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 23, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 20 }
		]
	},
	{
		id: 'tplink-eap670',
		vendor: 'TP-Link',
		model: 'EAP670',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'tplink-eap690e',
		vendor: 'TP-Link',
		model: 'EAP690E HD',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 26, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 20 }
		]
	},

	// ─── Google Nest / Home ──────────────────────────────────────────
	{
		id: 'google-nest-wifi-pro',
		vendor: 'Google',
		model: 'Nest WiFi Pro',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 19, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 19, typicalIndoorRange: 20 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 19, typicalIndoorRange: 15 }
		]
	},
	{
		id: 'google-nest-wifi',
		vendor: 'Google',
		model: 'Nest WiFi',
		wifiStandard: 'WiFi 5',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 19, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 19, typicalIndoorRange: 20 }
		]
	},

	// ─── Amazon eero ─────────────────────────────────────────────────
	{
		id: 'eero-pro-6e',
		vendor: 'eero',
		model: 'Pro 6E',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 25 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 18 }
		]
	},
	{
		id: 'eero-6-plus',
		vendor: 'eero',
		model: '6+',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 20, typicalIndoorRange: 22 }
		]
	},

	// ─── Netgear ─────────────────────────────────────────────────────
	{
		id: 'netgear-rax50',
		vendor: 'Netgear',
		model: 'Nighthawk RAX50',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25 }
		]
	},
	{
		id: 'netgear-raxe500',
		vendor: 'Netgear',
		model: 'Nighthawk RAXE500',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 22 }
		]
	},
	{
		id: 'netgear-orbi-rbke963',
		vendor: 'Netgear',
		model: 'Orbi RBKE963',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 28 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 20 }
		]
	},

	// ─── Linksys ─────────────────────────────────────────────────────
	{
		id: 'linksys-velop-mx5300',
		vendor: 'Linksys',
		model: 'Velop MX5300',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 22, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 22, typicalIndoorRange: 25 }
		]
	},

	// ─── ASUS ────────────────────────────────────────────────────────
	{
		id: 'asus-rt-ax86u',
		vendor: 'ASUS',
		model: 'RT-AX86U',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30 }
		]
	},
	{
		id: 'asus-zenwifi-et8',
		vendor: 'ASUS',
		model: 'ZenWiFi ET8',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 28 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 20 }
		]
	},
	{
		id: 'asus-rt-be96u',
		vendor: 'ASUS',
		model: 'RT-BE96U',
		wifiStandard: 'WiFi 7',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 25, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 30 },
			{ band: '6ghz', maxChannelWidth: 320, maxTxPower: 25, typicalIndoorRange: 22 }
		]
	},

	// ─── TP-Link Consumer ────────────────────────────────────────────
	{
		id: 'tplink-deco-xe75',
		vendor: 'TP-Link',
		model: 'Deco XE75',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 20, typicalIndoorRange: 22 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 20, typicalIndoorRange: 15 }
		]
	},
	{
		id: 'tplink-archer-ax73',
		vendor: 'TP-Link',
		model: 'Archer AX73',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 20, typicalIndoorRange: 25 }
		]
	},

	// ─── Apple ───────────────────────────────────────────────────────
	{
		id: 'apple-airport-express',
		vendor: 'Apple',
		model: 'AirPort Express',
		wifiStandard: 'WiFi 4',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 18, typicalIndoorRange: 25 },
			{ band: '5ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 15 }
		]
	},

	// ─── Sonos ───────────────────────────────────────────────────────
	{
		id: 'sonos-boost',
		vendor: 'Sonos',
		model: 'Boost',
		wifiStandard: 'WiFi 4',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 18, typicalIndoorRange: 25 },
			{ band: '5ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 15 }
		]
	}
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
