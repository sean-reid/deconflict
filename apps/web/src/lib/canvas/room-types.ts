/**
 * Room type definitions with device density for capacity-aware optimization.
 *
 * Device density values are sourced from:
 *   - Cisco Wireless High Client Density Design Guide (8.7)
 *   - Aruba VHD VRD Planning Guide
 *   - IBC Table 1004.5 (occupancy load factors)
 *   - Parks Associates CES 2024 (17 devices/US household)
 *   - Deloitte Connected Consumer Survey 2023 (21 devices/household)
 *
 * Density = expected concurrent WiFi devices per square meter,
 * accounting for phones, laptops, tablets, and IoT.
 */

export interface RoomType {
	id: number;
	name: string;
	shortName: string; // canvas label pill
	devicesPerSqm: number;
	color: [number, number, number]; // RGB for canvas tint (rendered at ~15% alpha)
}

export type RoomTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/**
 * Room types. ID 0 = unassigned (not in this array).
 * Colors use a cool→warm gradient by density:
 * low density = cool blue-gray, high density = warm amber/coral.
 * All are muted to stay cohesive with the dark UI at 15% alpha.
 */
export const ROOM_TYPES: readonly RoomType[] = [
	// ─── Commercial ──────────────────────────────────────────────
	// Cisco: transient, phones only. ~0.10-0.13 dev/sqm
	{ id: 1, name: 'Hallway', shortName: 'Hall', devicesPerSqm: 0.1, color: [130, 140, 160] },
	// Minimal human presence, IoT sensors only. ~0.05 dev/sqm
	{ id: 2, name: 'Storage', shortName: 'Store', devicesPerSqm: 0.05, color: [120, 120, 130] },
	// IBC: 14 sqm/person. Cisco: 2-3 dev/person. ~0.2 dev/sqm
	{
		id: 3,
		name: 'Private Office',
		shortName: 'Office',
		devicesPerSqm: 0.2,
		color: [100, 170, 140]
	},
	// IBC: 8 sqm/person. Cisco: 2.5 dev/person. ~0.3 dev/sqm
	{ id: 4, name: 'Open Office', shortName: 'Open', devicesPerSqm: 0.3, color: [80, 170, 165] },
	// IBC: 2 sqm/person assembly. Cisco HD: 2 dev/person. ~0.8 dev/sqm
	{ id: 5, name: 'Conference Room', shortName: 'Conf', devicesPerSqm: 0.8, color: [200, 170, 70] },
	// IBC: 1.9 sqm/person. 2 dev/student. ~1.0 dev/sqm
	{ id: 6, name: 'Classroom', shortName: 'Class', devicesPerSqm: 1.0, color: [210, 150, 60] },
	// IBC: 0.65 sqm/person concentrated. 1.5 dev/person. ~1.2 dev/sqm
	{ id: 7, name: 'Auditorium', shortName: 'Audit', devicesPerSqm: 1.2, color: [200, 100, 80] },
	// Variable: 5-15 transient. ~0.3 dev/sqm
	{ id: 8, name: 'Lobby', shortName: 'Lobby', devicesPerSqm: 0.3, color: [90, 170, 190] },
	// IBC: 1.4 sqm/person dining. 1.5 dev/person. ~0.8 dev/sqm
	{ id: 9, name: 'Cafeteria', shortName: 'Cafe', devicesPerSqm: 0.8, color: [190, 160, 80] },
	// IBC: 2.8 sqm/person retail. Staff POS + customer phones. ~0.2 dev/sqm
	{ id: 10, name: 'Retail Floor', shortName: 'Retail', devicesPerSqm: 0.2, color: [150, 140, 170] },
	// IoT sensors + management. Low human traffic. ~0.2 dev/sqm
	{ id: 11, name: 'Server Room', shortName: 'Server', devicesPerSqm: 0.2, color: [110, 130, 160] },

	// ─── Residential ─────────────────────────────────────────────
	// Parks: 30-40% of 17 devices concentrate here. ~0.4 dev/sqm
	{ id: 12, name: 'Living Room', shortName: 'Living', devicesPerSqm: 0.4, color: [130, 165, 140] },
	// 1-2 people, 3-5 devices. ~0.25 dev/sqm
	{ id: 13, name: 'Bedroom', shortName: 'Bed', devicesPerSqm: 0.25, color: [140, 140, 165] },
	// Smart appliances + phone. ~0.25 dev/sqm
	{ id: 14, name: 'Kitchen', shortName: 'Kitchen', devicesPerSqm: 0.25, color: [160, 150, 130] },
	// Highest residential density. Small room, full workstation. ~0.6 dev/sqm
	{ id: 15, name: 'Home Office', shortName: 'Office', devicesPerSqm: 0.6, color: [100, 170, 140] },
	// Large, sparse. IoT + occasional use. ~0.08 dev/sqm
	{ id: 16, name: 'Garage', shortName: 'Garage', devicesPerSqm: 0.08, color: [130, 130, 135] }
];

/** Look up a room type by ID. Returns undefined for ID 0 (unassigned). */
export function getRoomType(id: number): RoomType | undefined {
	return ROOM_TYPES.find((t) => t.id === id);
}
