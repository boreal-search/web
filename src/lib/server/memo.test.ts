import { describe, expect, it, vi } from 'vitest';
import { cached } from './memo';

describe('cached', () => {
	it('shares one call in flight and keeps the result for the ttl', async () => {
		let t = 0;
		const load = vi.fn(async () => t);
		const get = cached(1000, load, () => t);
		const [a, b] = await Promise.all([get(), get()]);
		expect([a, b, load.mock.calls.length]).toEqual([0, 0, 1]);
		t = 999;
		expect(await get()).toBe(0);
		t = 1000;
		expect(await get()).toBe(1000);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('does not keep a failure', async () => {
		const load = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error('down'))
			.mockResolvedValue('ok');
		const get = cached(60_000, load);
		await expect(get()).rejects.toThrow('down');
		expect(await get()).toBe('ok');
	});
});
