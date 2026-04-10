import { projectState } from '$state/project.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';

interface ProjectFile {
	version: 1;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
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

export function serialize(): string {
	const data: ProjectFile = {
		version: 1,
		name: projectState.name,
		band: projectState.band,
		channelWidth: projectState.channelWidth,
		regulatoryDomain: projectState.regulatoryDomain,
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

	if (!data.version || data.version !== 1) {
		throw new Error('Unsupported file version');
	}
	if (!Array.isArray(data.aps)) {
		throw new Error('Invalid project file: missing AP data');
	}

	projectState.name = data.name || 'Imported Project';
	projectState.band = data.band || '5ghz';
	projectState.channelWidth = data.channelWidth || 20;
	projectState.regulatoryDomain = data.regulatoryDomain || 'fcc';
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

export function downloadJson(): void {
	const json = serialize();
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
