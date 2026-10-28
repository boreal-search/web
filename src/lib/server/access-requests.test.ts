import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '#lib/supabase/types.js';
import {
	accessRequestEmail,
	isMissingTable,
	loadAccessRequest,
	parseAccessRequest
} from './access-requests';

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};

describe('parseAccessRequest', () => {
	it('normalises whitespace and treats an empty role as none', () => {
		expect(
			parseAccessRequest(
				form({
					organization: '  Acme \n Consulting ',
					role: '   ',
					use_case: '\r\n Search our EA archive.\r\nVol 1 to 9. '
				})
			)
		).toEqual({
			ok: true,
			value: {
				organization: 'Acme Consulting',
				role: null,
				useCase: 'Search our EA archive.\nVol 1 to 9.'
			}
		});
	});

	it('keeps a role', () => {
		const r = parseAccessRequest(form({ organization: 'Acme', role: ' EA lead ', use_case: 'x' }));
		expect(r).toMatchObject({ ok: true, value: { role: 'EA lead' } });
	});

	it('requires organization and use case, and keeps what was typed', () => {
		expect(parseAccessRequest(form({ organization: ' ', role: 'Lead', use_case: '' }))).toEqual({
			ok: false,
			values: { organization: '', role: 'Lead', useCase: '' },
			errors: {
				organization: "Enter your organization's name.",
				useCase: 'Say which documents you want to search, and why.'
			}
		});
	});

	it('treats missing fields as empty', () => {
		expect(parseAccessRequest(new FormData())).toMatchObject({
			ok: false,
			errors: { organization: expect.any(String), useCase: expect.any(String) }
		});
	});

	it('enforces the limits in characters, not UTF-16 units', () => {
		// 200 accented or astral characters are within the limit; 201 are not.
		expect(parseAccessRequest(form({ organization: 'é'.repeat(200), use_case: 'x' })).ok).toBe(
			true
		);
		expect(parseAccessRequest(form({ organization: '🌲'.repeat(200), use_case: 'x' })).ok).toBe(
			true
		);
		expect(
			parseAccessRequest(form({ organization: 'a'.repeat(201), use_case: 'x' }))
		).toMatchObject({ ok: false, errors: { organization: 'Use 200 characters or fewer.' } });
		expect(
			parseAccessRequest(form({ organization: 'a', role: 'r'.repeat(201), use_case: 'x' }))
		).toMatchObject({ ok: false, errors: { role: 'Use 200 characters or fewer.' } });
		expect(parseAccessRequest(form({ organization: 'a', use_case: 'u'.repeat(2000) })).ok).toBe(
			true
		);
		expect(
			parseAccessRequest(form({ organization: 'a', use_case: 'u'.repeat(2001) }))
		).toMatchObject({ ok: false, errors: { useCase: 'Use 2,000 characters or fewer.' } });
	});
});

describe('accessRequestEmail', () => {
	const request = {
		email: 'jane@acme.com',
		organization: 'Acme & <Sons>',
		role: null,
		useCase: 'Line one\nLine two'
	};
	const email = accessRequestEmail(request, 'https://borealsearch.app/admin');

	it('goes to support, with replies to the requester', () => {
		expect(email.to).toBe('support@borealsearch.app');
		expect(email.reply_to).toBe('jane@acme.com');
		expect(email.subject).toBe('Access request: Acme & <Sons>');
	});

	it('includes every field and the admin link in plain text', () => {
		expect(email.text).toContain('Email: jane@acme.com');
		expect(email.text).toContain('Organization: Acme & <Sons>');
		expect(email.text).toContain('Role: not given');
		expect(email.text).toContain('Line one\nLine two');
		expect(email.text).toContain('https://borealsearch.app/admin');
	});

	it('escapes user text in the HTML', () => {
		expect(email.html).toContain('Acme &amp; &lt;Sons&gt;');
		expect(email.html).not.toContain('<Sons>');
		expect(email.html).toContain('href="https://borealsearch.app/admin"');
	});
});

describe('isMissingTable', () => {
	it.each(['42P01', 'PGRST205'])('%s is a missing table', (code) => {
		expect(isMissingTable({ code })).toBe(true);
	});
	it.each([null, {}, { code: '42501' }, { code: 'PGRST116' }])('%j is not', (e) => {
		expect(isMissingTable(e)).toBe(false);
	});
});

describe('loadAccessRequest', () => {
	/** A client whose `from(...).select().eq().eq().maybeSingle()` resolves to `result`. */
	const client = (result: { data: unknown; error: unknown }) => {
		const chain = {
			select: () => chain,
			eq: () => chain,
			maybeSingle: () => Promise.resolve(result)
		};
		return { from: () => chain } as unknown as SupabaseClient<Database>;
	};

	it('returns the open request', async () => {
		const state = await loadAccessRequest(
			client({
				data: { email: 'j@a.com', organization: 'Acme', created_at: '2026-10-28T10:00:00Z' },
				error: null
			}),
			'u1'
		);
		expect(state).toEqual({
			available: true,
			open: { email: 'j@a.com', organization: 'Acme', createdAt: '2026-10-28T10:00:00Z' }
		});
	});

	it('returns no request', async () => {
		expect(await loadAccessRequest(client({ data: null, error: null }), 'u1')).toEqual({
			available: true,
			open: null
		});
	});

	it('tolerates the table not being migrated yet', async () => {
		const error = {
			code: 'PGRST205',
			message: "Could not find the table 'public.access_requests'"
		};
		expect(await loadAccessRequest(client({ data: null, error }), 'u1')).toEqual({
			available: false
		});
	});

	it('logs other errors and still does not throw', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await loadAccessRequest(client({ data: null, error: { code: '42501' } }), 'u1')).toEqual(
			{ available: false }
		);
		expect(log).toHaveBeenCalledOnce();
		log.mockRestore();
	});
});
