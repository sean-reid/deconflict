/**
 * Aruba (HPE) access point specifications.
 *
 * Sources:
 *   - Aruba datasheets (see per-model links below)
 *   - HPE QuickSpecs (search model at hpe.com/networking)
 *   - FCC ID prefix: Q9H
 *
 * TX power values are aggregate conducted power (dBm).
 * Aruba radios typically run 18 dBm per chain; 4x4 APs aggregate to ~24 dBm.
 */

import type { ApModel } from '../ap-models.js';

export const ARUBA_MODELS: readonly ApModel[] = [
	// ─── WiFi 6 ─────────────────────────────────────────────────────
	// FCC ID: Q9HAP503 | https://cdn.blueally.com/securewirelessworks/datasheets/access-points/ds_ap503series.pdf
	{
		id: 'aruba-ap503',
		vendor: 'Aruba',
		model: 'AP-503',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 21, typicalIndoorRange: 25 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 20 }
		]
	},
	// FCC ID: Q9HAP505 | https://www.also.com/ec/cms5/media/img/2800_hpe_portal/documents_1/access_points/ds_ap510series.pdf
	{
		id: 'aruba-ap505',
		vendor: 'Aruba',
		model: 'AP-505',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 22 }
		]
	},
	// FCC ID: Q9HAP515 | https://www.also.com/ec/cms5/media/img/2800_hpe_portal/documents_1/access_points/ds_ap510series.pdf
	{
		id: 'aruba-ap515',
		vendor: 'Aruba',
		model: 'AP-515',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 28 }
		]
	},
	// FCC ID: Q9HAP535 | https://www.also.com/ec/cms5/media/img/2800_hpe_portal/documents_1/access_points/ds_ap530series.pdf
	{
		id: 'aruba-ap535',
		vendor: 'Aruba',
		model: 'AP-535',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 28 }
		]
	},
	// FCC ID: Q9HAP575 | https://www.also.com/ec/cms5/media/img/2800_hpe_portal/documents_1/access_points/ds_ap570series.pdf
	{
		id: 'aruba-ap575',
		vendor: 'Aruba',
		model: 'AP-575',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 40 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 35 }
		]
	},

	// ─── WiFi 6E ────────────────────────────────────────────────────
	// FCC ID: Q9HAP615 | HPE QuickSpecs doc a50004285enw
	{
		id: 'aruba-ap615',
		vendor: 'Aruba',
		model: 'AP-615',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 22 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 16 }
		]
	},
	// FCC ID: Q9HAP635 | HPE QuickSpecs doc a50002582enw
	{
		id: 'aruba-ap635',
		vendor: 'Aruba',
		model: 'AP-635',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 28 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 22 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 16 }
		]
	},
	// FCC ID: Q9HAP655 | https://www.securewirelessworks.com/aruba-ap-655.asp
	{
		id: 'aruba-ap655',
		vendor: 'Aruba',
		model: 'AP-655',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 28 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 24, typicalIndoorRange: 20 }
		]
	}
];
