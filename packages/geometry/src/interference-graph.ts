import { euclidean } from './distance.js';

export interface ApPosition {
	id: string;
	x: number;
	y: number;
	interferenceRadius: number;
}

export interface InterferenceEdge {
	a: string;
	b: string;
}

export function buildInterferenceGraph(aps: ApPosition[]): {
	nodes: string[];
	edges: InterferenceEdge[];
} {
	const nodes = aps.map((ap) => ap.id);
	const edges: InterferenceEdge[] = [];

	for (let i = 0; i < aps.length; i++) {
		for (let j = i + 1; j < aps.length; j++) {
			const ai = aps[i]!;
			const aj = aps[j]!;
			const dist = euclidean({ x: ai.x, y: ai.y }, { x: aj.x, y: aj.y });
			if (dist < ai.interferenceRadius + aj.interferenceRadius) {
				edges.push({ a: ai.id, b: aj.id });
			}
		}
	}

	return { nodes, edges };
}
