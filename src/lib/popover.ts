/** Fixed position for a popover beside its trigger, opening up or down, left or right, to stay on screen. */
export function beside(
	r: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
	viewport: { width: number; height: number },
	gap = 4
) {
	const up = r.top > viewport.height / 2;
	const fromRight = r.left > viewport.width / 2;
	return {
		top: up ? 'auto' : `${r.bottom + gap}px`,
		bottom: up ? `${viewport.height - r.top + gap}px` : 'auto',
		left: fromRight ? 'auto' : `${r.left}px`,
		right: fromRight ? `${viewport.width - r.right}px` : 'auto'
	};
}
