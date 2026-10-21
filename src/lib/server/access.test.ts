import { describe, expect, it } from 'vitest';
import { findForbiddenDataSources } from './access';

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
