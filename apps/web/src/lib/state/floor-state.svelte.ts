import type { FloorMaterialId } from '$canvas/floor-materials.js';
import type { WallMaterialId } from '$canvas/materials.js';

export interface Floor {
	id: string;
	name: string;
	level: number;
	ceilingHeight: number; // meters (default 3.0 residential, 3.5 commercial)
	floorMaterial: FloorMaterialId;
	floorplanUrl: string | null;
	floorplanScale: number;
	calibration: { worldUnitsPerMeter: number } | null;
	floorplanBoundary: Array<{ x: number; y: number }> | null;
	wallMask: { dataUrl: string; width: number; height: number } | null;
	wallAttenuation: number;
	wallMaterial: WallMaterialId;
	materialMask: { dataUrl: string; width: number; height: number } | null;
}

function createDefaultFloor(id?: string, name?: string): Floor {
	return {
		id: id ?? crypto.randomUUID(),
		name: name ?? 'Floor 1',
		level: 0,
		ceilingHeight: 3.0,
		floorMaterial: 1, // Concrete Slab
		floorplanUrl: null,
		floorplanScale: 0.4,
		calibration: null,
		floorplanBoundary: null,
		wallMask: null,
		wallAttenuation: 5,
		wallMaterial: 0,
		materialMask: null
	};
}

const defaultFloor = createDefaultFloor();

export const floorState = $state({
	floors: [defaultFloor] as Floor[],
	currentFloorId: defaultFloor.id
});

/** Get the currently active floor. */
export function currentFloor(): Floor {
	return floorState.floors.find((f) => f.id === floorState.currentFloorId) ?? floorState.floors[0]!;
}

/** Get a floor by ID. */
export function getFloor(id: string): Floor | undefined {
	return floorState.floors.find((f) => f.id === id);
}

/** Add a new floor. Returns the new floor. */
export function addFloor(name?: string): Floor {
	const level = floorState.floors.length;
	const floor = createDefaultFloor(undefined, name ?? `Floor ${level + 1}`);
	floor.level = level;
	floorState.floors.push(floor);
	return floor;
}

/** Remove a floor by ID. Cannot remove the last floor. */
export function removeFloor(id: string): void {
	if (floorState.floors.length <= 1) return;
	floorState.floors = floorState.floors.filter((f) => f.id !== id);
	if (floorState.currentFloorId === id) {
		floorState.currentFloorId = floorState.floors[0]!.id;
	}
}

/** Switch to a floor. */
export function switchFloor(id: string): void {
	if (floorState.floors.some((f) => f.id === id)) {
		floorState.currentFloorId = id;
	}
}

/** Get floors adjacent to the given floor (level +/- 1). */
export function adjacentFloors(floorId: string): Floor[] {
	const floor = getFloor(floorId);
	if (!floor) return [];
	return floorState.floors.filter((f) => f.id !== floorId && Math.abs(f.level - floor.level) === 1);
}
