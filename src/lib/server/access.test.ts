import { describe, expect, it } from 'vitest';
import {
	availableContexts,
	contextValue,
	findForbiddenDataSources,
	resolveContext,
	searchableGroups,
	withDataSources,
	type Membership,
	type SearchContext
} from './access';

describe('findForbiddenDataSources', () => {
	it('returns nothing when every requested id is accessible', () => {
		expect(findForbiddenDataSources(['bc-regs', 'fed-regs'], ['bc-regs', 'fed-regs', 'x'])).toEqual(
			[]
		);
	});

	it('returns the ids the user may not query', () => {
		expect(findForbiddenDataSources(['bc-regs', 'secret'], ['bc-regs'])).toEqual(['secret']);
	});

	it('treats an empty accessible list as forbidding everything', () => {
		expect(findForbiddenDataSources(['a'], [])).toEqual(['a']);
	});

	it('dedupes repeated requested ids', () => {
		expect(findForbiddenDataSources(['a', 'a', 'b'], [])).toEqual(['a', 'b']);
	});

	it('allows an empty request', () => {
		expect(findForbiddenDataSources([], [])).toEqual([]);
	});
});

const acme: Membership = { id: 'o-acme', slug: 'acme', name: 'Acme', role: 'member' };
const beta: Membership = { id: 'o-beta', slug: 'beta', name: 'Beta', role: 'admin' };
const values = (cs: SearchContext[]) => cs.map(contextValue);

describe('availableContexts', () => {
	it('lists orgs by name, then Public when public corpora exist', () => {
		expect(values(availableContexts([beta, acme], true))).toEqual(['acme', 'beta', 'public']);
	});

	it('omits Public for org users when there are no public corpora', () => {
		expect(values(availableContexts([beta, acme], false))).toEqual(['acme', 'beta']);
	});

	it('gives a one-org user only their org: it already searches public corpora', () => {
		expect(values(availableContexts([acme], true))).toEqual(['acme']);
		expect(values(availableContexts([acme], false))).toEqual(['acme']);
	});

	it('always gives a user with no org the Public context', () => {
		expect(values(availableContexts([], false))).toEqual(['public']);
		expect(values(availableContexts([], true))).toEqual(['public']);
	});
});

describe('resolveContext', () => {
	const contexts = availableContexts([beta, acme], true);

	it('uses the org the cookie names when the user belongs to it', () => {
		expect(contextValue(resolveContext('beta', contexts))).toBe('beta');
		expect(contextValue(resolveContext('public', contexts))).toBe('public');
	});

	it('falls back to the first org by name for a missing or forged cookie', () => {
		expect(contextValue(resolveContext(undefined, contexts))).toBe('acme');
		expect(contextValue(resolveContext('someone-elses-org', contexts))).toBe('acme');
		expect(contextValue(resolveContext('o-beta', contexts))).toBe('acme'); // ids aren't slugs
	});

	it('ignores a public cookie when Public is not offered', () => {
		expect(contextValue(resolveContext('public', availableContexts([acme], false)))).toBe('acme');
	});

	it('falls back to Public for a user with no org', () => {
		expect(resolveContext('acme', availableContexts([], true))).toEqual({ kind: 'public' });
	});
});

describe('searchableGroups', () => {
	const inAcme: SearchContext = { kind: 'org', org: acme };

	it("in an org: the org's grants, then public corpora", () => {
		expect(searchableGroups(inAcme, ['acme-docs', 'bc-regs'], ['fed-regs'])).toEqual([
			{ label: 'Acme', ids: ['acme-docs', 'bc-regs'] },
			{ label: 'Public', ids: ['fed-regs'] }
		]);
	});

	it('lists a corpus that is both granted and public once, under Public', () => {
		expect(searchableGroups(inAcme, ['acme-docs', 'fed-regs'], ['fed-regs'])).toEqual([
			{ label: 'Acme', ids: ['acme-docs'] },
			{ label: 'Public', ids: ['fed-regs'] }
		]);
	});

	it('in Public: only public corpora, never org grants', () => {
		expect(searchableGroups({ kind: 'public' }, ['acme-docs'], ['fed-regs'])).toEqual([
			{ label: 'Public', ids: ['fed-regs'] }
		]);
	});

	it('drops empty groups', () => {
		expect(searchableGroups(inAcme, [], [])).toEqual([]);
		expect(searchableGroups(inAcme, ['a'], [])).toEqual([{ label: 'Acme', ids: ['a'] }]);
	});
});

describe('withDataSources', () => {
	it('attaches engine records per group and drops ids the engine does not list', () => {
		const list = [{ id: 'b' }, { id: 'a' }, { id: 'p' }];
		expect(
			withDataSources(
				[
					{ label: 'Acme', ids: ['a', 'b', 'gone'] },
					{ label: 'Public', ids: ['p'] }
				],
				list
			)
		).toEqual([
			{ label: 'Acme', dataSources: [{ id: 'b' }, { id: 'a' }] },
			{ label: 'Public', dataSources: [{ id: 'p' }] }
		]);
	});
});
