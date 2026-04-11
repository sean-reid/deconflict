import { projectState } from '$state/project.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';

interface ProjectFile {
	version: 2;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	floorplanImage?: string; // data URL of the floorplan image
	floorplanScale: number;
	calibration?: { worldUnitsPerMeter: number };
	walls: Array<{
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		thickness: number;
		material: string;
		attenuation: number;
	}>;
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
	}>;
}

async function floorplanToDataUrl(): Promise<string | undefined> {
	const url = projectState.floorplanUrl;
	if (!url) return undefined;

	// If already a data URL, use it directly
	if (url.startsWith('data:')) return url;

	// Convert blob URL to data URL via canvas
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
		name: projectState.name,
		band: projectState.band,
		channelWidth: projectState.channelWidth,
		regulatoryDomain: projectState.regulatoryDomain,
		floorplanImage,
		floorplanScale: projectState.floorplanScale,
		calibration: projectState.calibration ?? undefined,
		walls: JSON.parse(JSON.stringify(projectState.walls)),
		aps: projectState.aps.map((ap) => ({
			id: ap.id,
			name: ap.name,
			x: Math.round(ap.x * 100) / 100,
			y: Math.round(ap.y * 100) / 100,
			band: ap.band,
			channelWidth: ap.channelWidth,
			fixedChannel: ap.fixedChannel,
			assignedChannel: ap.assignedChannel,
			interferenceRadius: ap.interferenceRadius,
			power: ap.power
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

	projectState.name = data.name || 'Imported Project';
	projectState.band = data.band || '5ghz';
	projectState.channelWidth = data.channelWidth || 20;
	projectState.regulatoryDomain = data.regulatoryDomain || 'fcc';
	projectState.floorplanScale = data.floorplanScale ?? 0.4;
	projectState.calibration = data.calibration ?? null;
	projectState.walls = data.walls ?? [];

	// Restore floorplan image
	if (data.floorplanImage) {
		projectState.floorplanUrl = data.floorplanImage;
	} else {
		projectState.floorplanUrl = null;
	}

	projectState.aps = data.aps.map((ap) => ({
		id: ap.id || crypto.randomUUID(),
		name: ap.name || 'AP',
		x: ap.x ?? 0,
		y: ap.y ?? 0,
		band: ap.band || data.band || '5ghz',
		channelWidth: ap.channelWidth || data.channelWidth || 20,
		fixedChannel: ap.fixedChannel ?? null,
		assignedChannel: ap.assignedChannel ?? null,
		interferenceRadius: ap.interferenceRadius ?? 150,
		power: ap.power ?? 20
	}));
}

export async function downloadJson(): Promise<void> {
	const json = await serialize();
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${projectState.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.deconflict.json`;
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
