import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import { channelColor } from '@deconflict/channels';

const UNASSIGNED_COLOR = '#6b7185';
const LABEL_COLOR = '#8b8fa3';
const BADGE_BG = 'rgba(0, 0, 0, 0.6)';
const BADGE_TEXT = '#ffffff';
const ACCENT_CYAN = '#00d4ff';

export class ApLayer implements Layer {
	id = 'aps';
	visible = true;

	aps: AccessPoint[] = [];
	selectedIds: string[] = [];
	hoveredId: string | null = null;

	render(rc: RenderContext): void {
		const { ctx, camera, dpr } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;
		const [a, b, c, d, e, f] = transform;
		ctx.setTransform(a, b, c, d, e, f);

		const screenScale = 1 / (zoom * dpr);

		for (const ap of this.aps) {
			const isSelected = this.selectedIds.includes(ap.id);
			const isHovered = this.hoveredId === ap.id;

			const color =
				ap.assignedChannel !== null ? channelColor(ap.assignedChannel, ap.band) : UNASSIGNED_COLOR;

			const radius = 7 * screenScale;

			// Selection glow
			if (isSelected) {
				ctx.save();
				ctx.shadowBlur = 12 * screenScale;
				ctx.shadowColor = ACCENT_CYAN;
				ctx.beginPath();
				ctx.arc(ap.x, ap.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = color;
				ctx.fill();
				ctx.restore();
			}

			// Filled circle
			ctx.beginPath();
			ctx.arc(ap.x, ap.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();

			// Border ring
			ctx.beginPath();
			ctx.arc(ap.x, ap.y, radius, 0, Math.PI * 2);
			ctx.lineWidth = 1.5 * screenScale;

			if (isSelected) {
				ctx.strokeStyle = ACCENT_CYAN;
			} else if (isHovered) {
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
			} else {
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
			}
			ctx.stroke();

			// Hover brightness boost ring
			if (isHovered && !isSelected) {
				ctx.beginPath();
				ctx.arc(ap.x, ap.y, radius + 2 * screenScale, 0, Math.PI * 2);
				ctx.lineWidth = 1 * screenScale;
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
				ctx.stroke();
			}

			// Name label below the dot
			const fontSize = 10 * screenScale;
			ctx.font = `${fontSize}px monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			ctx.fillStyle = LABEL_COLOR;
			ctx.fillText(ap.name, ap.x, ap.y + radius + 4 * screenScale);

			// Channel badge above-right if assigned
			if (ap.assignedChannel !== null) {
				const badgeText = String(ap.assignedChannel);
				const badgeFontSize = 8 * screenScale;
				ctx.font = `bold ${badgeFontSize}px monospace`;
				const textMetrics = ctx.measureText(badgeText);
				const badgePadX = 3 * screenScale;
				const badgePadY = 2 * screenScale;
				const badgeW = textMetrics.width + badgePadX * 2;
				const badgeH = badgeFontSize + badgePadY * 2;
				const badgeX = ap.x + radius + 2 * screenScale;
				const badgeY = ap.y - radius - badgeH;
				const badgeRadius = 3 * screenScale;

				// Rounded rect
				ctx.beginPath();
				ctx.moveTo(badgeX + badgeRadius, badgeY);
				ctx.lineTo(badgeX + badgeW - badgeRadius, badgeY);
				ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeRadius, badgeRadius);
				ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeRadius);
				ctx.arcTo(
					badgeX + badgeW,
					badgeY + badgeH,
					badgeX + badgeW - badgeRadius,
					badgeY + badgeH,
					badgeRadius
				);
				ctx.lineTo(badgeX + badgeRadius, badgeY + badgeH);
				ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeRadius, badgeRadius);
				ctx.lineTo(badgeX, badgeY + badgeRadius);
				ctx.arcTo(badgeX, badgeY, badgeX + badgeRadius, badgeY, badgeRadius);
				ctx.closePath();
				ctx.fillStyle = BADGE_BG;
				ctx.fill();

				// Badge text
				ctx.fillStyle = BADGE_TEXT;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
			}
		}
	}
}
