/**
 * Backward-compatible re-export layer.
 *
 * The actual state lives in four focused atoms:
 *   - apState (ap-state.svelte.ts) — APs, band, channelWidth, regulatoryDomain
 *   - floorplanState (floorplan-state.svelte.ts) — floorplan, calibration, units
 *   - wallState (wall-state.svelte.ts) — wall mask, materials
 *   - projectMeta (project-meta.svelte.ts) — name, ISP speed, target throughput
 *
 * This file provides `projectState` as a unified view for files that haven't
 * migrated yet. New code should import from the specific atom it needs.
 */

// Re-export atoms
export { apState } from './ap-state.svelte.js';
export { floorplanState } from './floorplan-state.svelte.js';
export { wallState } from './wall-state.svelte.js';
export { projectMeta } from './project-meta.svelte.js';

// Re-export types and functions
export type { AccessPoint } from './ap-state.svelte.js';
export {
	addAp,
	removeAp,
	removeAps,
	updateAp,
	moveAp,
	beginMove,
	clearAssignments,
	resetApNumbering,
	getEffectiveWupm,
	radiusFromPower,
	DEFAULT_WUPM
} from './ap-state.svelte.js';

// Re-export a unified projectState for backward compatibility.
// Consumers should migrate to importing the specific atom they need.
import { apState } from './ap-state.svelte.js';
import { floorplanState } from './floorplan-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import { projectMeta } from './project-meta.svelte.js';

/** @deprecated Import from the specific atom instead. */
export const projectState = {
	get name() {
		return projectMeta.name;
	},
	set name(v) {
		projectMeta.name = v;
	},
	get band() {
		return apState.band;
	},
	set band(v) {
		apState.band = v;
	},
	get channelWidth() {
		return apState.channelWidth;
	},
	set channelWidth(v) {
		apState.channelWidth = v;
	},
	get regulatoryDomain() {
		return apState.regulatoryDomain;
	},
	set regulatoryDomain(v) {
		apState.regulatoryDomain = v;
	},
	get aps() {
		return apState.aps;
	},
	set aps(v) {
		apState.aps = v;
	},
	get floorplanUrl() {
		return floorplanState.floorplanUrl;
	},
	set floorplanUrl(v) {
		floorplanState.floorplanUrl = v;
	},
	get floorplanScale() {
		return floorplanState.floorplanScale;
	},
	set floorplanScale(v) {
		floorplanState.floorplanScale = v;
	},
	get calibration() {
		return floorplanState.calibration;
	},
	set calibration(v) {
		floorplanState.calibration = v;
	},
	get floorplanBoundary() {
		return floorplanState.floorplanBoundary;
	},
	set floorplanBoundary(v) {
		floorplanState.floorplanBoundary = v;
	},
	get unitSystem() {
		return floorplanState.unitSystem;
	},
	set unitSystem(v) {
		floorplanState.unitSystem = v;
	},
	get ispSpeed() {
		return projectMeta.ispSpeed;
	},
	set ispSpeed(v) {
		projectMeta.ispSpeed = v;
	},
	get targetThroughput() {
		return projectMeta.targetThroughput;
	},
	set targetThroughput(v) {
		projectMeta.targetThroughput = v;
	},
	get wallMask() {
		return wallState.wallMask;
	},
	set wallMask(v) {
		wallState.wallMask = v;
	},
	get wallAttenuation() {
		return wallState.wallAttenuation;
	},
	set wallAttenuation(v) {
		wallState.wallAttenuation = v;
	},
	get wallMaterial() {
		return wallState.wallMaterial;
	},
	set wallMaterial(v) {
		wallState.wallMaterial = v;
	},
	get materialMask() {
		return wallState.materialMask;
	},
	set materialMask(v) {
		wallState.materialMask = v;
	},
	get roomTypeMask() {
		return wallState.roomTypeMask;
	},
	set roomTypeMask(v) {
		wallState.roomTypeMask = v;
	}
};
