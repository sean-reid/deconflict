import { apState } from '$state/ap-state.svelte.js';
import { floorplanState } from '$state/floorplan-state.svelte.js';
import { wallState } from '$state/wall-state.svelte.js';
import { projectMeta } from '$state/project-meta.svelte.js';
import { floorState } from '$state/floor-state.svelte.js';
import { appState } from '$state/app.svelte.js';
import { clearSelection } from '$state/canvas.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import type { WallMaterialId } from '$canvas/materials.js';
import type { FloorMaterialId } from '$canvas/floor-materials.js';

// ─── V3 format (multi-floor) ───────────────────────────────────────

interface ProjectFloorV3 {
	id: string;
	name: string;
	level: number;
	ceilingHeight: number;
	floorMaterial: FloorMaterialId;
	floorThickness: number;
	floorplanImage?: string;
	floorplanScale: number;
	calibration?: { worldUnitsPerMeter: number };
	floorplanBoundary?: Array<{ x: number; y: number }> | null;
	wallMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	wallAttenuation?: number;
	wallMaterial?: number;
	materialMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
}

interface ProjectFileV3 {
	version: 3;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	unitSystem?: 'imperial' | 'metric';
	ispSpeed?: number;
	targetThroughput?: number;
	floors: ProjectFloorV3[];
	aps: Array<{
		id: string;
		name: string;
		x: number;
		y: number;
		band: Band;
		channelWidth: ChannelWidth;
		fixedChannel: number | null;
		assignedChannel: number | null;
		interferenceRadius: number;
		power: number;
		modelId?: string | null;
		modelLabel?: string | null;
		floorId: string;
	}>;
}

// ─── V2 format (legacy single-floor) ───────────────────────────────

interface ProjectFileV2 {
	version: 2;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	unitSystem?: 'imperial' | 'metric';
	floorplanImage?: string;
	floorplanScale: number;
	calibration?: { worldUnitsPerMeter: number };
	floorplanBoundary?: Array<{ x: number; y: number }> | null;
	wallMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	wallAttenuation?: number;
	wallMaterial?: number;
	materialMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	aps: Array<{
		id: string;
		name: string;
		x: number;
		y: number;
		band: Band;
		channelWidth: ChannelWidth;
		fixedChannel: number | null;
		assignedChannel: number | null;
		interferenceRadius: number;
		power: number;
		modelId?: string | null;
		modelLabel?: string | null;
		floorId?: string;
	}>;
}

type ProjectFile = ProjectFileV2 | ProjectFileV3;

// ─── Helpers ────────────────────────────────────────────────────────

async function floorplanToDataUrl(url: string | null): Promise<string | undefined> {
	if (!url) return undefined;
	if (url.startsWith('data:')) return url;

	try {
		const img = new Image();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = reject;
			img.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		return canvas.toDataURL('image/png');
	} catch {
		return undefined;
	}
}

// ─── Serialize (always v3) ──────────────────────────────────────────

export async function serialize(): Promise<string> {
	const floors: ProjectFloorV3[] = [];

	for (const floor of floorState.floors) {
		const floorplanImage = await floorplanToDataUrl(floor.floorplanUrl);
		floors.push({
			id: floor.id,
			name: floor.name,
			level: floor.level,
			ceilingHeight: floor.ceilingHeight,
			floorMaterial: floor.floorMaterial,
			floorThickness: floor.floorThickness,
			floorplanImage,
			floorplanScale: floor.floorplanScale,
			calibration: floor.calibration ?? undefined,
			floorplanBoundary: floor.floorplanBoundary ?? undefined,
			wallMask: floor.wallMask ? JSON.parse(JSON.stringify(floor.wallMask)) : null,
			wallAttenuation: floor.wallAttenuation,
			wallMaterial: floor.wallMaterial,
			materialMask: floor.materialMask ? JSON.parse(JSON.stringify(floor.materialMask)) : null
		});
	}

	const data: ProjectFileV3 = {
		version: 3,
		name: projectMeta.name,
		band: apState.band,
		channelWidth: apState.channelWidth,
		regulatoryDomain: apState.regulatoryDomain,
		unitSystem: floorplanState.unitSystem,
		ispSpeed: projectMeta.ispSpeed,
		targetThroughput: projectMeta.targetThroughput,
		floors,
		aps: apState.aps.map((ap) => ({
			id: ap.id,
			name: ap.name,
			x: Math.round(ap.x * 100) / 100,
			y: Math.round(ap.y * 100) / 100,
			band: ap.band,
			channelWidth: ap.channelWidth,
			fixedChannel: ap.fixedChannel,
			assignedChannel: ap.assignedChannel,
			interferenceRadius: ap.interferenceRadius,
			power: ap.power,
			modelId: ap.modelId ?? null,
			modelLabel: ap.modelLabel ?? null,
			floorId: ap.floorId
		}))
	};
	return JSON.stringify(data, null, '\t');
}

// ─── Deserialize (v2 or v3) ─────────────────────────────────────────

function migrateV2(data: ProjectFileV2): ProjectFileV3 {
	const floorId = crypto.randomUUID();
	return {
		version: 3,
		name: data.name || 'Imported Project',
		band: data.band || '5ghz',
		channelWidth: data.channelWidth || 20,
		regulatoryDomain: data.regulatoryDomain || 'fcc',
		unitSystem: data.unitSystem ?? 'imperial',
		floors: [
			{
				id: floorId,
				name: 'Floor 1',
				level: 0,
				ceilingHeight: 3.0,
				floorMaterial: 1,
				floorplanImage: data.floorplanImage,
				floorThickness: 0.2,
				floorplanScale: data.floorplanScale ?? 0.4,
				calibration: data.calibration,
				floorplanBoundary: data.floorplanBoundary,
				wallMask: data.wallMask,
				wallAttenuation: data.wallAttenuation,
				wallMaterial: data.wallMaterial,
				materialMask: data.materialMask
			}
		],
		aps: (data.aps || []).map((ap) => ({
			...ap,
			floorId: ap.floorId ?? floorId,
			modelId: ap.modelId ?? null,
			modelLabel: ap.modelLabel ?? null
		}))
	};
}

export function deserialize(json: string): void {
	let parsed: ProjectFile;
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new Error('Invalid JSON file');
	}

	if (!parsed.version) {
		throw new Error('Unsupported file version');
	}

	const data: ProjectFileV3 = parsed.version === 2 ? migrateV2(parsed) : parsed;

	if (!data.floors || data.floors.length === 0) {
		throw new Error('Invalid project file: no floors');
	}

	// Project meta
	projectMeta.name = data.name || 'Imported Project';
	projectMeta.ispSpeed = data.ispSpeed ?? 0;
	projectMeta.targetThroughput = data.targetThroughput ?? 25;

	// AP defaults
	apState.band = data.band || '5ghz';
	apState.channelWidth = data.channelWidth || 20;
	apState.regulatoryDomain = data.regulatoryDomain || 'fcc';

	// Unit system
	floorplanState.unitSystem = data.unitSystem ?? 'imperial';

	// Floors
	floorState.floors = data.floors.map((f) => ({
		id: f.id,
		name: f.name,
		level: f.level,
		ceilingHeight: f.ceilingHeight ?? 3.0,
		floorMaterial: (f.floorMaterial ?? 1) as FloorMaterialId,
		floorThickness: (f as any).floorThickness ?? 0.2,
		floorplanUrl: f.floorplanImage ?? null,
		floorplanScale: f.floorplanScale ?? 0.4,
		calibration: f.calibration ?? null,
		floorplanBoundary: f.floorplanBoundary ?? null,
		wallMask: f.wallMask
			? { ...f.wallMask, originX: f.wallMask.originX ?? 0, originY: f.wallMask.originY ?? 0 }
			: null,
		wallAttenuation: f.wallAttenuation ?? 5,
		wallMaterial: (f.wallMaterial ?? 0) as WallMaterialId,
		materialMask: f.materialMask
			? {
					...f.materialMask,
					originX: f.materialMask.originX ?? 0,
					originY: f.materialMask.originY ?? 0
				}
			: null
	}));
	floorState.currentFloorId = floorState.floors[0]!.id;

	// Sync current floor to legacy atoms
	const cur = floorState.floors[0]!;
	floorplanState.floorplanUrl = cur.floorplanUrl;
	floorplanState.floorplanScale = cur.floorplanScale;
	floorplanState.calibration = cur.calibration;
	floorplanState.floorplanBoundary = cur.floorplanBoundary;
	wallState.wallMask = cur.wallMask;
	wallState.wallAttenuation = cur.wallAttenuation;
	wallState.wallMaterial = cur.wallMaterial;
	wallState.materialMask = cur.materialMask;

	// APs
	apState.aps = data.aps.map((ap) => ({
		id: ap.id || crypto.randomUUID(),
		name: ap.name || 'AP',
		x: ap.x ?? 0,
		y: ap.y ?? 0,
		band: ap.band || data.band || '5ghz',
		channelWidth: ap.channelWidth || data.channelWidth || 20,
		fixedChannel: ap.fixedChannel ?? null,
		assignedChannel: ap.assignedChannel ?? null,
		interferenceRadius: ap.interferenceRadius ?? 150,
		power: ap.power ?? 20,
		modelId: ap.modelId ?? null,
		modelLabel: ap.modelLabel ?? null,
		floorId: ap.floorId ?? floorState.currentFloorId
	}));

	clearSelection();
	if (data.aps.length > 0) {
		appState.sidebarPanel = 'aps';
		appState.sidebarOpen = true;
	} else if (data.floors[0]?.floorplanImage) {
		appState.sidebarPanel = 'floorplan';
	}
}

export async function downloadJson(): Promise<void> {
	const json = await serialize();
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${projectMeta.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.deconflict.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function importJson(file: File): Promise<void> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				deserialize(reader.result as string);
				resolve();
			} catch (err) {
				reject(err);
			}
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});
}
