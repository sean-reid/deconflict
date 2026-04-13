/**
 * Enterprise WiFi access point specifications (EnGenius, Fortinet).
 *
 * Sources:
 *   - EnGenius datasheets: https://www.engeniustech.com/engenius-products
 *   - Fortinet datasheets: https://www.fortinet.com/content/dam/fortinet/assets/data-sheets
 *   - AVFirewalls specs: https://www.avfirewalls.com
 *
 * TX power values are conducted power (dBm) from manufacturer datasheets.
 */

import type { ApModel } from '../ap-models.js';

export const ENTERPRISE_MODELS: readonly ApModel[] = [
	// ─── EnGenius ────────────────────────────────────────────────────
	// https://static.engeniuscdn.com/wp-content/uploads/2020/09/04211400/EWS377AP_11ax_DataSheet_20200901.pdf
	{
		id: 'engenius-ews377ap',
		vendor: 'EnGenius',
		model: 'EWS377AP',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 28 }
		]
	},
	// https://www.engeniustech.com/wp-content/uploads/2021/07/ECW230-Datasheet.pdf
	{
		id: 'engenius-ecw230',
		vendor: 'EnGenius',
		model: 'ECW230',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 28 }
		]
	},
	// https://www.engeniustech.com/wp-content/uploads/2022/03/ECW336-Datasheet.pdf
	{
		id: 'engenius-ecw336',
		vendor: 'EnGenius',
		model: 'ECW336',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 28 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 20 }
		]
	},

	// ─── Fortinet ───────────────────────────────────────────────────
	// https://www.avfirewalls.com/fortiap-231f.asp
	{
		id: 'fortinet-fap-231f',
		vendor: 'Fortinet',
		model: 'FAP-231F',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 19, typicalIndoorRange: 25 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 22 }
		]
	},
	// https://www.avfirewalls.com/fortiap-431f.asp
	{
		id: 'fortinet-fap-431f',
		vendor: 'Fortinet',
		model: 'FAP-431F',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 24, typicalIndoorRange: 35 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 23, typicalIndoorRange: 28 }
		]
	},
	// https://www.avfirewalls.com/fortiap-831f.asp
	{
		id: 'fortinet-fap-831f',
		vendor: 'Fortinet',
		model: 'FAP-831F',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 20, typicalIndoorRange: 30 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 28 }
		]
	}
];
