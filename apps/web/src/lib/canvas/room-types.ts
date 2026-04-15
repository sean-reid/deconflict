/**
 * Room type definitions with device density for capacity-aware optimization.
 *
 * Default density values sourced from:
 *   - Cisco Wireless High Client Density Design Guide (8.7)
 *   - Aruba VHD VRD Planning Guide
 *   - IBC Table 1004.5 (occupancy load factors)
 *   - Parks Associates CES 2024 (17 devices/US household)
 *   - Deloitte Connected Consumer Survey 2023
 *
 * Density = expected concurrent WiFi devices per square meter.
 * Users can override the default density per room via the popup.
 */

export type BuildingCategory =
	| 'commercial'
	| 'residential'
	| 'education'
	| 'healthcare'
	| 'hospitality'
	| 'industrial';

export interface RoomType {
	id: number;
	name: string;
	shortName: string; // canvas label pill
	categories: BuildingCategory[]; // which building types this room appears in
	defaultDensity: number; // devices per sqm (user-overridable per room)
	color: [number, number, number]; // RGB for canvas tint (rendered at ~15% alpha)
}

/**
 * Room types. ID 0 = unassigned (not in this array).
 * Colors follow a cool→warm gradient by density within each category.
 */
export const ROOM_TYPES: readonly RoomType[] = [
	// ─── Default ─────────────────────────────────────────────────
	{
		id: 1,
		name: 'Custom',
		shortName: 'Custom',
		categories: [
			'commercial',
			'residential',
			'education',
			'healthcare',
			'hospitality',
			'industrial'
		],
		defaultDensity: 0.3,
		color: [150, 150, 155]
	},

	// ─── Low traffic ─────────────────────────────────────────────
	{
		id: 2,
		name: 'Hallway',
		shortName: 'Hall',
		categories: ['commercial', 'education', 'healthcare', 'hospitality'],
		defaultDensity: 0.1,
		color: [130, 140, 160]
	},
	{
		id: 3,
		name: 'Stairwell',
		shortName: 'Stair',
		categories: ['commercial', 'education', 'healthcare'],
		defaultDensity: 0.03,
		color: [115, 115, 125]
	},
	{
		id: 4,
		name: 'Storage',
		shortName: 'Store',
		categories: ['commercial', 'residential', 'industrial'],
		defaultDensity: 0.05,
		color: [120, 120, 130]
	},
	{
		id: 5,
		name: 'Restroom',
		shortName: 'WC',
		categories: ['commercial', 'education', 'healthcare', 'hospitality'],
		defaultDensity: 0.08,
		color: [125, 130, 145]
	},
	{
		id: 6,
		name: 'Elevator Lobby',
		shortName: 'Elev',
		categories: ['commercial', 'hospitality'],
		defaultDensity: 0.1,
		color: [125, 135, 150]
	},
	{
		id: 7,
		name: 'Warehouse',
		shortName: 'Whse',
		categories: ['commercial', 'industrial'],
		defaultDensity: 0.05,
		color: [115, 120, 130]
	},
	{
		id: 8,
		name: 'Server Room',
		shortName: 'Server',
		categories: ['commercial', 'education'],
		defaultDensity: 0.2,
		color: [110, 130, 160]
	},

	// IBC Group A-3; congregants with phones. ~0.1 dev/sqm
	{
		id: 9,
		name: 'Place of Worship',
		shortName: 'Worship',
		categories: ['commercial'],
		defaultDensity: 0.1,
		color: [135, 135, 155]
	},

	// ─── Medium traffic ──────────────────────────────────────────
	{
		id: 10,
		name: 'Private Office',
		shortName: 'Office',
		categories: ['commercial', 'education', 'healthcare'],
		defaultDensity: 0.2,
		color: [100, 170, 140]
	},
	{
		id: 11,
		name: 'Open Office',
		shortName: 'Open',
		categories: ['commercial'],
		defaultDensity: 0.3,
		color: [80, 170, 165]
	},
	{
		id: 12,
		name: 'Lobby',
		shortName: 'Lobby',
		categories: ['commercial', 'hospitality', 'healthcare'],
		defaultDensity: 0.3,
		color: [90, 170, 190]
	},
	{
		id: 13,
		name: 'Retail Floor',
		shortName: 'Retail',
		categories: ['commercial'],
		defaultDensity: 0.2,
		color: [150, 140, 170]
	},
	{
		id: 14,
		name: 'Waiting Room',
		shortName: 'Wait',
		categories: ['healthcare', 'commercial'],
		defaultDensity: 0.35,
		color: [110, 160, 170]
	},
	{
		id: 15,
		name: 'Library',
		shortName: 'Library',
		categories: ['education', 'commercial'],
		defaultDensity: 0.25,
		color: [120, 155, 150]
	},
	{
		id: 16,
		name: 'Lab',
		shortName: 'Lab',
		categories: ['education', 'healthcare', 'commercial'],
		defaultDensity: 0.2,
		color: [130, 150, 160]
	},
	{
		id: 17,
		name: 'Exam Room',
		shortName: 'Exam',
		categories: ['healthcare'],
		defaultDensity: 0.25,
		color: [130, 165, 155]
	},
	{
		id: 18,
		name: 'Hotel Room',
		shortName: 'Hotel',
		categories: ['hospitality'],
		defaultDensity: 0.3,
		color: [140, 150, 165]
	},
	{
		id: 19,
		name: 'Gym',
		shortName: 'Gym',
		categories: ['commercial', 'hospitality', 'residential'],
		defaultDensity: 0.4,
		color: [160, 155, 100]
	},

	// 2-4 people in tiny room + display. ~0.5 dev/sqm
	{
		id: 40,
		name: 'Huddle Room',
		shortName: 'Huddle',
		categories: ['commercial'],
		defaultDensity: 0.5,
		color: [150, 165, 110]
	},
	// FICM 830; workstations, wireless-on-wheels. ~0.35 dev/sqm
	{
		id: 41,
		name: 'Nurse Station',
		shortName: 'Nurse',
		categories: ['healthcare'],
		defaultDensity: 0.35,
		color: [120, 165, 160]
	},
	// FICM 810; patient devices + 5-8 medical IoT. ~0.5 dev/sqm
	{
		id: 42,
		name: 'Patient Room',
		shortName: 'Patient',
		categories: ['healthcare'],
		defaultDensity: 0.5,
		color: [140, 160, 150]
	},
	// 15-20 connected medical devices per ICU room. ~0.7 dev/sqm
	{
		id: 43,
		name: 'ICU',
		shortName: 'ICU',
		categories: ['healthcare'],
		defaultDensity: 0.7,
		color: [180, 140, 90]
	},
	// 1-2 guests x 3 devices + smart TV + IoT. ~0.2 dev/sqm
	{
		id: 44,
		name: 'Guest Room',
		shortName: 'Guest',
		categories: ['hospitality'],
		defaultDensity: 0.2,
		color: [140, 145, 160]
	},
	// Aruba: 1 AP/400sqm; cameras + IoT. ~0.01 dev/sqm
	{
		id: 45,
		name: 'Parking Garage',
		shortName: 'Parking',
		categories: ['commercial', 'residential'],
		defaultDensity: 0.01,
		color: [110, 110, 120]
	},
	// FICM 525; phones + wearables. ~0.1 dev/sqm
	{
		id: 46,
		name: 'Locker Room',
		shortName: 'Locker',
		categories: ['education', 'hospitality', 'commercial'],
		defaultDensity: 0.1,
		color: [130, 140, 145]
	},
	// POS + customer phones. ~0.15 dev/sqm
	{
		id: 47,
		name: 'Food Court',
		shortName: 'Food',
		categories: ['commercial', 'hospitality'],
		defaultDensity: 0.15,
		color: [165, 150, 95]
	},

	// ─── High traffic ────────────────────────────────────────────
	{
		id: 20,
		name: 'Conference Room',
		shortName: 'Conf',
		categories: ['commercial'],
		defaultDensity: 0.8,
		color: [200, 170, 70]
	},
	{
		id: 21,
		name: 'Boardroom',
		shortName: 'Board',
		categories: ['commercial'],
		defaultDensity: 0.6,
		color: [190, 165, 80]
	},
	{
		id: 22,
		name: 'Cafeteria',
		shortName: 'Cafe',
		categories: ['commercial', 'education', 'healthcare'],
		defaultDensity: 0.8,
		color: [190, 160, 80]
	},
	{
		id: 23,
		name: 'Classroom',
		shortName: 'Class',
		categories: ['education'],
		defaultDensity: 1.0,
		color: [210, 150, 60]
	},
	{
		id: 24,
		name: 'Call Center',
		shortName: 'Calls',
		categories: ['commercial'],
		defaultDensity: 0.5,
		color: [170, 160, 90]
	},
	{
		id: 25,
		name: 'Auditorium',
		shortName: 'Audit',
		categories: ['education', 'commercial'],
		defaultDensity: 1.2,
		color: [200, 100, 80]
	},
	{
		id: 26,
		name: 'Event Space',
		shortName: 'Event',
		categories: ['hospitality', 'commercial'],
		defaultDensity: 1.5,
		color: [210, 90, 70]
	},
	{
		id: 27,
		name: 'Restaurant',
		shortName: 'Rest',
		categories: ['hospitality', 'commercial'],
		defaultDensity: 0.7,
		color: [185, 155, 85]
	},

	// Similar to classroom; all on laptops. ~0.4 dev/sqm
	{
		id: 28,
		name: 'Training Room',
		shortName: 'Train',
		categories: ['commercial', 'education'],
		defaultDensity: 0.4,
		color: [195, 155, 75]
	},
	// Events: 1 person/1.5sqm x 1.5 devices. ~0.6 dev/sqm
	{
		id: 29,
		name: 'Banquet Hall',
		shortName: 'Banq',
		categories: ['hospitality', 'commercial'],
		defaultDensity: 0.6,
		color: [195, 130, 75]
	},

	// ─── Residential ─────────────────────────────────────────────
	{
		id: 30,
		name: 'Living Room',
		shortName: 'Living',
		categories: ['residential'],
		defaultDensity: 0.4,
		color: [130, 165, 140]
	},
	{
		id: 31,
		name: 'Bedroom',
		shortName: 'Bed',
		categories: ['residential', 'hospitality'],
		defaultDensity: 0.25,
		color: [140, 140, 165]
	},
	{
		id: 32,
		name: 'Kitchen',
		shortName: 'Kitchen',
		categories: ['residential'],
		defaultDensity: 0.25,
		color: [160, 150, 130]
	},
	{
		id: 33,
		name: 'Dining Room',
		shortName: 'Dining',
		categories: ['residential'],
		defaultDensity: 0.2,
		color: [145, 150, 140]
	},
	{
		id: 34,
		name: 'Home Office',
		shortName: 'Office',
		categories: ['residential'],
		defaultDensity: 0.6,
		color: [100, 170, 140]
	},
	{
		id: 35,
		name: 'Bathroom',
		shortName: 'Bath',
		categories: ['residential'],
		defaultDensity: 0.15,
		color: [130, 145, 155]
	},
	{
		id: 36,
		name: 'Garage',
		shortName: 'Garage',
		categories: ['residential', 'industrial'],
		defaultDensity: 0.08,
		color: [130, 130, 135]
	},
	{
		id: 37,
		name: 'Basement',
		shortName: 'Bsmt',
		categories: ['residential'],
		defaultDensity: 0.06,
		color: [120, 125, 130]
	},
	{
		id: 38,
		name: 'Laundry',
		shortName: 'Lndry',
		categories: ['residential', 'commercial'],
		defaultDensity: 0.1,
		color: [125, 135, 140]
	},
	{
		id: 39,
		name: 'Patio',
		shortName: 'Patio',
		categories: ['residential'],
		defaultDensity: 0.1,
		color: [120, 150, 135]
	}
];

/** Look up a room type by ID. Returns undefined for ID 0 (unassigned). */
export function getRoomType(id: number): RoomType | undefined {
	return ROOM_TYPES.find((t) => t.id === id);
}

/** The default room type — used when users don't know the room function yet. */
export const DEFAULT_ROOM_TYPE_ID = 1;

/** Get room types filtered by building category. */
export function getRoomTypesForCategory(category: BuildingCategory): RoomType[] {
	return ROOM_TYPES.filter((t) => t.categories.includes(category));
}
