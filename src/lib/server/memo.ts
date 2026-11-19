import type { RequestEvent } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/** `load`, run at most once per request: every load and action in the request shares it. */
export function perRequest<T>(load: (event: RequestEvent) => Promise<T>): () => Promise<T> {
	const memo = new WeakMap<App.Locals, Promise<T>>();
	return () => {
		const event = getRequestEvent();
		let p = memo.get(event.locals);
		if (!p) {
			p = load(event);
			// Callers may start it early and not await it on every path (a redirect, a 404).
			p.catch(() => {});
			memo.set(event.locals, p);
		}
		return p;
	};
}

/**
 * `load`, shared by every request on this server instance for `ttlMs`; concurrent callers share
 * the call in flight. A failure is not kept: the next caller tries again.
 */
export function cached<T>(ttlMs: number, load: () => Promise<T>, now = Date.now): () => Promise<T> {
	let entry: { at: number; value: Promise<T> } | null = null;
	return () => {
		if (entry && now() - entry.at < ttlMs) return entry.value;
		const value = load();
		const mine = (entry = { at: now(), value });
		value.catch(() => {
			if (entry === mine) entry = null;
		});
		return value;
	};
}
