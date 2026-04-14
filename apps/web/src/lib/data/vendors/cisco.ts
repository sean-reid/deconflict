/**
 * Cisco Meraki and Catalyst WiFi access point specifications.
 *
 * Sources:
 *   - Meraki datasheets: https://documentation.meraki.com/Wireless/Product_Information
 *   - Catalyst CW TX power tables (see per-model links below)
 *   - Meraki community TX power threads (search "transmit power" on community.meraki.com)
 *   - FCC ID prefix: Z64 (Meraki), LDK (Catalyst)
 *
 * TX power values are conducted power (dBm). Meraki publishes aggregate power
 * for multi-chain APs. Values cross-referenced with community reports.
 */

import type { ApModel } from '../ap-models.js';

export const CISCO_MODELS: readonly ApModel[] = [
	// ─── Meraki WiFi 6 ──────────────────────────────────────────────
	// FCC ID: Z64-102179 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR28_Datasheet
	// MIMO: 2x2:2 on both radios per datasheet
	{
		id: 'meraki-mr28',
		vendor: 'Cisco Meraki',
		model: 'MR28',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 20, maxTxPower: 18, typicalIndoorRange: 25, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 17, typicalIndoorRange: 20, streams: 2 }
		]
	},
	// FCC ID: Z64-102085 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR36_Datasheet
	// MIMO: 2x2:2 on both radios per datasheet
	{
		id: 'meraki-mr36',
		vendor: 'Cisco Meraki',
		model: 'MR36',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 18, typicalIndoorRange: 22, streams: 2 }
		]
	},
	// FCC ID: Z64-102130 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR36H_Datasheet
	// MIMO: 2x2:2 on both radios per datasheet
	{
		id: 'meraki-mr36h',
		vendor: 'Cisco Meraki',
		model: 'MR36H',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 22, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 18, typicalIndoorRange: 18, streams: 2 }
		]
	},
	// FCC ID: Z64-102101 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR44_Datasheet
	{
		id: 'meraki-mr44',
		vendor: 'Cisco Meraki',
		model: 'MR44',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 18, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 18, typicalIndoorRange: 22, streams: 4 }
		]
	},
	// FCC ID: Z64-102086 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR46_Datasheet
	// MIMO: 4x4:4 on both radios per datasheet
	{
		id: 'meraki-mr46',
		vendor: 'Cisco Meraki',
		model: 'MR46',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// FCC ID: Z64-102094 | https://documentation.meraki.com/MR/MR_Overview_and_Specifications/MR46E_Datasheet
	// MIMO: 4x4:4 on both radios per datasheet
	{
		id: 'meraki-mr46e',
		vendor: 'Cisco Meraki',
		model: 'MR46E',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 4 }
		]
	},
	// FCC ID: Z64-102088 | https://documentation.meraki.com/MR/MR_Overview_and_Specifications/MR45_and_MR55_Datasheet
	// MIMO: 4x4:4 on 2.4GHz, 8x8:8 on 5GHz per datasheet
	{
		id: 'meraki-mr55',
		vendor: 'Cisco Meraki',
		model: 'MR55',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 35, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 25, typicalIndoorRange: 28, streams: 8 }
		]
	},
	// FCC ID: Z64-102089 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR56_Datasheet
	{
		id: 'meraki-mr56',
		vendor: 'Cisco Meraki',
		model: 'MR56',
		wifiStandard: 'WiFi 6',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 26, typicalIndoorRange: 40, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 27, typicalIndoorRange: 32, streams: 8 }
		]
	},

	// ─── Meraki WiFi 6E ─────────────────────────────────────────────
	// FCC ID: Z64-102177 | https://documentation.meraki.com/Wireless/Product_Information/Overviews_and_Datasheets/MR57_Datasheet
	{
		id: 'meraki-mr57',
		vendor: 'Cisco Meraki',
		model: 'MR57',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	},

	// ─── Catalyst WiFi 6E ───────────────────────────────────────────
	// FCC ID: LDK102352 | https://www.cisco.com/c/en/us/td/docs/wireless/access_point/cw916x/cw9162/install-guide/b-hig-cw9162i/tx-power-rx-sensitivity.html
	{
		id: 'cisco-cw9162',
		vendor: 'Cisco',
		model: 'CW9162',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 80, maxTxPower: 21, typicalIndoorRange: 22, streams: 2 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 21, typicalIndoorRange: 16, streams: 2 }
		]
	},
	// FCC ID: LDK102362 | https://www.cisco.com/c/en/us/td/docs/wireless/access_point/cw916x/cw9164/install-guide/b-hig-cw9164i/tx-power-rx-sensitivity.html
	{
		id: 'cisco-cw9164',
		vendor: 'Cisco',
		model: 'CW9164',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 21, typicalIndoorRange: 28, streams: 2 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	},
	// FCC ID: LDK102361 | https://www.cisco.com/c/en/us/td/docs/wireless/access_point/cw916x/cw9166/install-guide/b-hig-cw9166i/tx-power-rx-sensitivity.html
	{
		id: 'cisco-cw9166',
		vendor: 'Cisco',
		model: 'CW9166',
		wifiStandard: 'WiFi 6E',
		bands: [
			{ band: '2.4ghz', maxChannelWidth: 40, maxTxPower: 23, typicalIndoorRange: 32, streams: 4 },
			{ band: '5ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 25, streams: 4 },
			{ band: '6ghz', maxChannelWidth: 160, maxTxPower: 23, typicalIndoorRange: 18, streams: 4 }
		]
	}
];
