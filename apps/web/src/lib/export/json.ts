import { apState } from '$state/ap-state.svelte.js';
import { floorplanState } from '$state/floorplan-state.svelte.js';
import { wallState } from '$state/wall-state.svelte.js';
import { projectMeta } from '$state/project-meta.svelte.js';
import { appState } from '$state/app.svelte.js';
import { clearSelection } from '$state/canvas.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import type { WallMaterialId } from '$canvas/materials.js';

interface ProjectFile {
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
	wallMask?: { dataUrl: string; width: number; height: number } | null;
	wallAttenuation?: number;
	wallMaterial?: number;
	materialMask?: { dataUrl: string; width: number; height: number } | null;
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
	}>;
}

async function floorplanToDataUrl(): Promise<string | undefined> {
	const url = floorplanState.floorplanUrl;
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

export async function serialize(): Promise<string> {
	const floorplanImage = await floorplanToDataUrl();

	const data: ProjectFile = {
		version: 2,
		name: projectMeta.name,
		band: apState.band,
		channelWidth: apState.channelWidth,
		regulatoryDomain: apState.regulatoryDomain,
		unitSystem: floorplanState.unitSystem,
		floorplanImage,
		floorplanScale: floorplanState.floorplanScale,
		calibration: floorplanState.calibration ?? undefined,
		floorplanBoundary: floorplanState.floorplanBoundary ?? undefined,
		wallMask: wallState.wallMask ? JSON.parse(JSON.stringify(wallState.wallMask)) : null,
		wallAttenuation: wallState.wallAttenuation,
		wallMaterial: wallState.wallMaterial,
		materialMask: wallState.materialMask
			? JSON.parse(JSON.stringify(wallState.materialMask))
			: null,
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
			modelLabel: ap.modelLabel ?? null
		}))
	};
	return JSON.stringify(data, null, '\t');
}

export function deserialize(json: string): void {
	let data: ProjectFile;
	try {
		data = JSON.parse(json);
	} catch {
		throw new Error('Invalid JSON file');
	}

	if (!data.version) {
		throw new Error('Unsupported file version');
	}
	if (!Array.isArray(data.aps)) {
		throw new Error('Invalid project file: missing AP data');
	}

	projectMeta.name = data.name || 'Imported Project';
	projectMeta.ispSpeed = 0;
	projectMeta.targetThroughput = data.aps.length > 0 ? 25 : 50;

	apState.band = data.band || '5ghz';
	apState.channelWidth = data.channelWidth || 20;
	apState.regulatoryDomain = data.regulatoryDomain || 'fcc';

	floorplanState.unitSystem = data.unitSystem ?? 'imperial';
	floorplanState.floorplanScale = data.floorplanScale ?? 0.4;
	floorplanState.calibration = data.calibration ?? null;
	floorplanState.floorplanBoundary = data.floorplanBoundary ?? null;

	wallState.wallMask = data.wallMask ?? null;
	wallState.wallAttenuation = data.wallAttenuation ?? 5;
	wallState.wallMaterial = (data.wallMaterial ?? 0) as WallMaterialId;
	wallState.materialMask = data.materialMask ?? null;

	if (data.floorplanImage) {
		floorplanState.floorplanUrl = data.floorplanImage;
	} else {
		floorplanState.floorplanUrl = null;
	}

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
		modelLabel: ap.modelLabel ?? null
	}));

	clearSelection();
	if (data.aps.length > 0) {
		appState.sidebarPanel = 'aps';
		appState.sidebarOpen = true;
	} else if (data.floorplanImage) {
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
