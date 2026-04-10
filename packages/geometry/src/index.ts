export type { Point, Circle, Rect, Matrix2D } from './types.js';
export { euclidean, squaredEuclidean, pointToSegment } from './distance.js';
export {
	circlesOverlap,
	circleOverlapArea,
	pointInCircle,
	pointInRect,
	rectsOverlap
} from './intersection.js';
export { identity, translate, scale, multiply, invert, applyToPoint } from './transform.js';
export type { ApPosition, InterferenceEdge } from './interference-graph.js';
export { buildInterferenceGraph } from './interference-graph.js';
