// Permanent page and PDF links (`/pages/…`, `/pdf/…`): web signs engine `/files/` URLs on
// demand, so nothing stored or left open holds an expiring URL. The key layout and the signing
// scheme are shared contract with the engine (`boreal_engine/storage.py`: `page_key`,
// `document_key`, `KEY_RE`, `sign`); change both in the same release.
// Design: infra/docs/handovers/2026-10-28-page-links-and-trail.md.
import { createHmac } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { ENGINE_URL, FILE_SIGNING_KEY } from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { CONTEXT_COOKIE, getAccess } from './access.js';
import { requireUser } from './auth.js';

const DS = '[A-Za-z0-9][A-Za-z0-9._-]{0,63}';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** The engine's `KEY_RE`: anything else is a 404 there, so it is one here too. */
const KEY_RE = new RegExp(
	`^(?:documents/${DS}/${UUID}\\.pdf|pages/${DS}/${UUID}/[1-9][0-9]{0,5}\\.webp)$`
);

export const pageKey = (ds: string, doc: string, page: number | string) =>
	`pages/${ds}/${doc}/${page}.webp`;
export const documentKey = (ds: string, doc: string) => `documents/${ds}/${doc}.pdf`;
export const isValidKey = (key: string) => KEY_RE.test(key);

/** HMAC-SHA256 hex over `"{key}\n{exp}"`, exactly as the engine's `sign`. */
export const sign = (signingKey: string, key: string, exp: number) =>
	createHmac('sha256', signingKey).update(`${key}\n${exp}`).digest('hex');

/** Whether web can sign: `FILE_SIGNING_KEY` is set. Without it, use the engine's signed URLs. */
export const canSign = () => FILE_SIGNING_KEY !== undefined;

/**
 * Signed engine URL for `key`, or null without `FILE_SIGNING_KEY`. Expiry is rounded up to a
 * `ttl` boundary (valid ttl..2·ttl from now), so repeat requests in one window get the same URL
 * and the browser and Cloudflare caches hit. The engine origin is `ENGINE_URL`
 * (its `PUBLIC_BASE_URL`).
 */
export function signFileUrl(key: string, ttl = 900, now = Date.now() / 1000): string | null {
	if (!FILE_SIGNING_KEY) return null;
	const exp = (Math.floor(now / ttl) + 2) * ttl;
	const base = ENGINE_URL.replace(/\/+$/, '');
	return `${base}/files/${key}?exp=${exp}&sig=${sign(FILE_SIGNING_KEY, key, exp)}`;
}

/** Signed in, and `ds` is in the current context's set; else login, or 404 like data source pages. */
export async function requireFileAccess(ds: string) {
	const user = requireUser();
	const { locals, cookies } = getRequestEvent();
	const { dataSourceIds } = await getAccess(locals.supabase, user.id, cookies.get(CONTEXT_COOKIE));
	if (!dataSourceIds.includes(ds)) notFound();
}

export const notFound = (): never =>
	error(404, 'Data source not found', { failure: { kind: 'not_found', what: 'data_source' } });

/**
 * The redirect to a signed URL. Cached privately for 10 minutes, well inside the signature's
 * lifetime, so a search page doesn't re-check auth and access for every render; revoked access
 * can linger that long in this browser.
 */
export const signedRedirect = (location: string) =>
	new Response(null, {
		status: 302,
		headers: { location, 'cache-control': 'private, max-age=600' }
	});
