// What failed and whose problem it is: the one vocabulary for the error page (`App.Error`) and
// inline notices (`FailureNotice.svelte`). Engine failures come from `classifyEngineError`;
// the rest are raised by routes and `handleError`. Copy rules: docs/ui.md "Copy".

/** Why an engine call failed, in terms the user can act on. */
export type EngineFailure =
	/** No response within ENGINE_TIMEOUT_MS. */
	| { kind: 'timeout' }
	/** Network error, or the tunnel's 502/504/530: the workstation is off or restarting. */
	| { kind: 'unreachable' }
	/** 503: the engine is up but Qdrant or Ollama is down. */
	| { kind: 'unavailable'; detail: string }
	/** Any other engine error (status null when it wasn't an HTTP error). */
	| { kind: 'error'; status: number | null; detail: string };

/** What a 404 was about. "Doesn't exist" and "not in your current context" read the same. */
export type Missing = 'page' | 'data_source' | 'org' | 'trail';

/** Who may open a role-gated page. */
export type Gate = 'platform_admin' | 'org_admin';

export type Failure =
	| EngineFailure
	| { kind: 'not_found'; what: Missing }
	/** `org` names the org for org-admin pages. */
	| { kind: 'forbidden'; gate: Gate | null; org?: string }
	/** A 4xx the user can fix by going back (e.g. a forged context switch). */
	| { kind: 'bad_request'; status: number; detail: string }
	/** Boreal's side: an unexpected error. `ref` matches the server log line; null if not logged. */
	| { kind: 'internal'; ref: string | null; at: string | null };

/** How a failure reads: a headline, then why, then what to do. */
export interface FailureCopy {
	title: string;
	/** Why it happened; null when the title says it all. */
	cause: string | null;
	/** What to do next. */
	next: string;
	/** `error` (danger, role=alert) only for Boreal-side failures; engine problems are never red. */
	tone: 'neutral' | 'error';
	/** Mono readings for support: status, detail, reference. Never the headline. */
	readout: { label: string; value: string }[];
	/** Whether "Try again" can help. */
	retry: boolean;
}

export interface FailureContext {
	/** The user has more than one context, so the "Searching in" switcher is shown. */
	canSwitch?: boolean;
}

const STILL_WORKS = "Pages that don't need search, like your account, still work.";

/** "2026-10-28T14:03:12.345Z" → "2026-10-28 14:03:12 UTC": the form log lines use. */
const utc = (iso: string) => `${iso.slice(0, 19).replace('T', ' ')} UTC`;

export function describeFailure(f: Failure, ctx: FailureContext = {}): FailureCopy {
	const base: Pick<FailureCopy, 'tone' | 'readout' | 'retry'> = {
		tone: 'neutral',
		readout: [],
		retry: false
	};
	switch (f.kind) {
		case 'unreachable':
			return {
				...base,
				title: 'Search is offline',
				cause: "The search engine's server is off or restarting.",
				next: `Try again in a few minutes. ${STILL_WORKS}`,
				retry: true
			};
		case 'timeout':
			return {
				...base,
				title: "The search engine didn't respond in time",
				cause: 'It may be busy or starting up.',
				next: 'Try again in a moment.',
				retry: true
			};
		case 'unavailable':
			return {
				...base,
				title: 'Search is temporarily unavailable',
				cause: 'The search engine is running, but a service it depends on is down.',
				next: `Try again in a few minutes. ${STILL_WORKS}`,
				readout: [
					{ label: 'search engine', value: '503' },
					{ label: 'detail', value: f.detail }
				],
				retry: true
			};
		case 'error':
			return {
				...base,
				title: "The search engine couldn't complete the request",
				cause: null,
				next: 'Try again. If it keeps happening, contact us with the reading below.',
				readout: [
					{ label: 'search engine', value: f.status === null ? 'no status' : String(f.status) },
					{ label: 'detail', value: f.detail }
				],
				retry: true
			};
		case 'not_found': {
			const home = 'Go to your data sources.';
			if (f.what === 'page') {
				return {
					...base,
					title: 'Page not found',
					cause: 'The address may be mistyped, or the page may have moved.',
					next: 'Check the address, or start again from your data sources.'
				};
			}
			if (f.what === 'trail') {
				return {
					...base,
					title: 'Trail not found',
					cause: "It may have been deleted, or it isn't shared with you.",
					next: 'Go to your trails, or start a new search.'
				};
			}
			if (f.what === 'org') {
				return {
					...base,
					title: 'Org not found',
					cause: "It may not exist, or you're not a member of it.",
					next: home
				};
			}
			return {
				...base,
				title: 'Data source not found',
				cause: "It may not exist, or it may belong to an org you're not searching in right now.",
				next: ctx.canSwitch
					? 'Switch org with "Searching in" at the top of the page, or go to your data sources.'
					: home
			};
		}
		case 'forbidden':
			if (f.gate === 'platform_admin') {
				return {
					...base,
					title: 'Only platform admins can open this page',
					cause: 'Platform admins run Boreal itself: orgs and public data sources.',
					next: 'If you need this page, contact us.'
				};
			}
			if (f.gate === 'org_admin') {
				const org = f.org ?? 'this org';
				return {
					...base,
					title: `Only org admins can manage ${org}`,
					cause: null,
					next: `Ask an org admin of ${org} to make you an org admin.`
				};
			}
			return {
				...base,
				title: "You don't have access to this page",
				cause: null,
				next: 'Ask your org admin if you need it.'
			};
		case 'bad_request':
			return {
				...base,
				title: "That request didn't work",
				cause: null,
				next: 'Go back and try again.',
				readout: [{ label: 'detail', value: f.detail }]
			};
		case 'internal':
			return {
				...base,
				title: "Something went wrong on Boreal's side",
				cause: "It's not something you did.",
				next: f.ref
					? 'Try again. If it keeps happening, contact us and quote the reference below.'
					: 'Try again. If it keeps happening, contact us.',
				tone: 'error',
				readout: [
					...(f.ref ? [{ label: 'ref', value: f.ref }] : []),
					...(f.at ? [{ label: 'at', value: utc(f.at) }] : [])
				],
				retry: true
			};
	}
}

/**
 * The failure behind an error page: the one the route or `handleError` attached, else read
 * from the status (SvelteKit's own 404s, plain `error(status, message)` calls).
 */
export function pageFailure({ status, message, failure }: App.Error): Failure {
	if (failure) return failure;
	if (status === 404) return { kind: 'not_found', what: 'page' };
	if (status === 403) return { kind: 'forbidden', gate: null };
	if (status >= 400 && status < 500) return { kind: 'bad_request', status, detail: message };
	return { kind: 'internal', ref: null, at: null };
}
