import { describe, expect, it } from 'vitest';
import {
	inviteEmail,
	isPublicEmailDomain,
	parseDomain,
	parseEmail,
	parseRole,
	parseSlug,
	planGrantChanges
} from './orgs';

describe('parseEmail', () => {
	it('trims and lower-cases', () => {
		expect(parseEmail('  Jane.Doe@ACME.com ')).toBe('jane.doe@acme.com');
	});
	it.each([null, '', 'jane', 'jane@acme', 'ja ne@acme.com', '@acme.com'])('rejects %j', (v) => {
		expect(parseEmail(v)).toBeNull();
	});
});

describe('parseDomain', () => {
	it.each([
		['acme.com', 'acme.com'],
		['@Acme.COM ', 'acme.com'],
		['mail.acme.co.uk', 'mail.acme.co.uk']
	])('%j → %j', (input, out) => {
		expect(parseDomain(input)).toBe(out);
	});
	it.each(['', 'acme', 'acme_corp.com', '-acme.com', 'jane@acme.com', 'acme..com'])(
		'rejects %j',
		(v) => {
			expect(parseDomain(v)).toBeNull();
		}
	);
});

describe('isPublicEmailDomain', () => {
	it.each([
		'gmail.com',
		'googlemail.com',
		'outlook.com',
		'hotmail.com',
		'hotmail.co.uk',
		'yahoo.com',
		'yahoo.co.jp',
		'icloud.com',
		'proton.me',
		'protonmail.com',
		'gmx.de',
		'aol.com'
	])('flags %j', (d) => {
		expect(isPublicEmailDomain(d)).toBe(true);
	});
	it.each(['acme.com', 'mail.acme.com', 'gmail.acme.com', 'live.acme.co.uk', 'boreal.ca'])(
		'allows %j',
		(d) => {
			expect(isPublicEmailDomain(d)).toBe(false);
		}
	);
});

describe('parseSlug', () => {
	it('accepts the orgs.slug format, lower-casing', () => {
		expect(parseSlug(' Acme-Corp ')).toBe('acme-corp');
	});
	it.each(['', 'a', '-acme', 'acme corp', 'acme_corp'])('rejects %j', (v) => {
		expect(parseSlug(v)).toBeNull();
	});
});

describe('parseRole', () => {
	it('accepts the enum values only', () => {
		expect(parseRole('admin')).toBe('admin');
		expect(parseRole('member')).toBe('member');
		expect(parseRole('owner')).toBeNull();
		expect(parseRole(null)).toBeNull();
	});
});

describe('planGrantChanges', () => {
	it('adds newly checked and removes unchecked ids', () => {
		expect(planGrantChanges(['a', 'b'], ['b', 'c'], ['a', 'b', 'c'])).toEqual({
			add: ['c'],
			remove: ['a']
		});
	});
	it('is a no-op when nothing changed', () => {
		expect(planGrantChanges(['a'], ['a'], ['a', 'b'])).toEqual({ add: [], remove: [] });
	});
	it('never touches ids the engine does not list', () => {
		expect(planGrantChanges(['gone'], ['forged'], ['a'])).toEqual({ add: [], remove: [] });
	});
});

describe('inviteEmail', () => {
	it('links to login and escapes the org name in HTML', () => {
		const email = inviteEmail('new@acme.com', 'A&B <Co>', 'https://app.test/login');
		expect(email.to).toBe('new@acme.com');
		expect(email.subject).toBe("You're invited to A&B <Co> on Boreal Search");
		expect(email.html).toContain('<strong>A&amp;B &lt;Co&gt;</strong>');
		expect(email.html).toContain('href="https://app.test/login"');
		expect(email.text).toContain('https://app.test/login');
	});
});
