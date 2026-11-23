import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { floorState } from './floor-state.svelte.js';
import { floorplanState } from './floorplan-state.svelte.js';
import { persistenceState, scheduleSave } from './persistence.svelte.js';

const PROJECT_KEY = 'deconflict:project';
const FLOORPLAN_PREFIX = 'deconflict:floorplan:';

class MemoryStorage {
	map = new Map<string, string>();
	/** Throw this from `setItem` for keys matched by `failWhen`. */
	failWhen: ((key: string) => boolean) | null = null;
	error: unknown = new DOMException('The quota has been exceeded.', 'QuotaExceededError');

	get length() {
		return this.map.size;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		if (this.failWhen?.(key)) throw this.error;
		this.map.set(key, value);
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
}

/** Image whose load completes as soon as `src` is set. */
class FakeImage {
	naturalWidth = 10;
	naturalHeight = 10;
	onload: (() => void) | null = null;
	set src(_value: string) {
		this.onload?.();
	}
}

let storage: MemoryStorage;
let firstFloorId: string;
let secondFloorId: string;

function save(): void {
	scheduleSave();
	vi.advanceTimersByTime(2000);
}

describe('persistence of floorplan images', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		storage = new MemoryStorage();
		vi.stubGlobal('localStorage', storage);
		vi.stubGlobal('Image', FakeImage);
		vi.stubGlobal('document', {
			createElement: () => ({
				width: 0,
				height: 0,
				getContext: () => ({ drawImage: () => {} }),
				toDataURL: () => 'data:image/png;base64,AAAA'
			})
		});

		// Two floors: the first (current) has a floorplan, the second has none.
		const [first] = floorState.floors;
		floorState.floors = [first!];
		firstFloorId = first!.id;
		secondFloorId = 'second-floor';
		floorState.floors.push({ ...first!, id: secondFloorId, name: 'Floor 2', floorplanUrl: null });
		floorState.currentFloorId = firstFloorId;
		floorplanState.floorplanUrl = 'blob:first-floor';
		persistenceState.storageError = null;
	});

	afterEach(() => {
		floorplanState.floorplanUrl = null;
		floorState.floors = floorState.floors.slice(0, 1);
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('stores one image per floor with a floorplan', () => {
		save();

		expect(storage.getItem(`${FLOORPLAN_PREFIX}${firstFloorId}`)).toBe(
			'data:image/png;base64,AAAA'
		);
		expect(storage.getItem(`${FLOORPLAN_PREFIX}${secondFloorId}`)).toBeNull();
	});

	it('deletes images of floors that no longer exist', () => {
		storage.setItem(`${FLOORPLAN_PREFIX}deleted-floor`, 'old');
		storage.setItem(`${FLOORPLAN_PREFIX}another-deleted-floor`, 'old');
		storage.setItem('deconflict:floorplan', 'legacy single-floorplan key');
		storage.setItem('unrelated', 'keep me');

		save();

		expect(storage.getItem(`${FLOORPLAN_PREFIX}deleted-floor`)).toBeNull();
		expect(storage.getItem(`${FLOORPLAN_PREFIX}another-deleted-floor`)).toBeNull();
		expect(storage.getItem(`${FLOORPLAN_PREFIX}${firstFloorId}`)).not.toBeNull();
		// Only per-floor keys are pruned.
		expect(storage.getItem('deconflict:floorplan')).toBe('legacy single-floorplan key');
		expect(storage.getItem('unrelated')).toBe('keep me');
	});

	it('removes the image of a floor whose floorplan was removed', () => {
		storage.setItem(`${FLOORPLAN_PREFIX}${secondFloorId}`, 'stale image');

		save();

		expect(storage.getItem(`${FLOORPLAN_PREFIX}${secondFloorId}`)).toBeNull();
	});

	it('keeps the image of a floor restored from storage (data URL)', () => {
		floorState.floors[1]!.floorplanUrl = 'data:image/png;base64,RESTORED';
		storage.setItem(`${FLOORPLAN_PREFIX}${secondFloorId}`, 'data:image/png;base64,RESTORED');

		save();

		expect(storage.getItem(`${FLOORPLAN_PREFIX}${secondFloorId}`)).toBe(
			'data:image/png;base64,RESTORED'
		);
	});

	it('frees the space of stale images before writing the project', () => {
		storage.setItem(`${FLOORPLAN_PREFIX}deleted-floor`, 'x'.repeat(100));
		// Full as long as the stale image is still there.
		storage.failWhen = (key) =>
			key === PROJECT_KEY && storage.map.has(`${FLOORPLAN_PREFIX}deleted-floor`);

		save();

		expect(storage.getItem(PROJECT_KEY)).not.toBeNull();
		expect(persistenceState.storageError).toBeNull();
	});

	it('reports a full storage when the floorplan image does not fit', () => {
		storage.failWhen = (key) => key.startsWith(FLOORPLAN_PREFIX);

		save();

		expect(persistenceState.storageError).toBe('Storage full: floorplan not saved');
	});

	it('reports a full storage when the project does not fit', () => {
		storage.failWhen = (key) => key === PROJECT_KEY;

		save();

		expect(persistenceState.storageError).toBe('Storage full: project not saved');
	});

	it('clears the warning after a save that fits', () => {
		storage.failWhen = () => true;
		save();
		expect(persistenceState.storageError).not.toBeNull();

		storage.failWhen = null;
		save();

		expect(persistenceState.storageError).toBeNull();
	});

	it('stays silent for storage errors that are not about the quota', () => {
		storage.error = new DOMException('Access denied', 'SecurityError');
		storage.failWhen = () => true;

		save();

		expect(persistenceState.storageError).toBeNull();
	});
});
