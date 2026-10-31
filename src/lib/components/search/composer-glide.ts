// The composer moves when a trail gets its first step (centred start screen → pinned at the
// bottom of the steps) and back. Svelte mounts a new box there, so the page reads where the old
// one was (`spot`, before the DOM changes) and then slides the new one in from it (`glide`).

/** Where the composer was, and whether the viewer was in it. */
export interface ComposerSpot {
	top: number;
	focused: boolean;
}

const box = () => document.querySelector<HTMLFormElement>('form.composer');

export function spot(): ComposerSpot | null {
	const form = box();
	if (!form) return null;
	return { top: form.getBoundingClientRect().top, focused: form.contains(document.activeElement) };
}

/** Only for a viewer who was in the composer (their search moved it): keep focus in its box and
 * slide it from where it was, unless they prefer reduced motion. */
export function glide(from: ComposerSpot) {
	const form = box();
	if (!form || !from.focused) return;
	form.querySelector<HTMLInputElement>('input[name=query]')?.focus({ preventScroll: true });
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const dy = from.top - form.getBoundingClientRect().top;
	if (Math.abs(dy) < 1) return;
	form.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
		duration: 320,
		easing: 'cubic-bezier(0.2, 0, 0, 1)'
	});
}
