import { describe, expect, it } from 'vitest';
import { ndjson } from './ndjson.js';

const bytes = (...chunks: string[]) => {
	const enc = new TextEncoder();
	return new ReadableStream<Uint8Array<ArrayBuffer>>({
		start(c) {
			for (const s of chunks) c.enqueue(enc.encode(s));
			c.close();
		}
	});
};

const all = async <T>(it: AsyncIterable<T>) => {
	const out: T[] = [];
	for await (const v of it) out.push(v);
	return out;
};

describe('ndjson', () => {
	it('joins lines split across chunks and skips blank lines', async () => {
		const values = await all(ndjson(bytes('{"a":1}\n{"b"', ':2}\n\n', '  \n{"c":3}\n')));
		expect(values).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
	});

	it('keeps a final line without a newline', async () => {
		expect(await all(ndjson(bytes('{"a":1}\n{"done":true}')))).toEqual([{ a: 1 }, { done: true }]);
	});

	it('decodes a character split across chunks', async () => {
		const enc = new TextEncoder().encode('{"q":"é"}\n');
		const split = new ReadableStream<Uint8Array<ArrayBuffer>>({
			start(c) {
				c.enqueue(enc.slice(0, 7));
				c.enqueue(enc.slice(7));
				c.close();
			}
		});
		expect(await all(ndjson(split))).toEqual([{ q: 'é' }]);
	});

	it('throws on a line that is not JSON', async () => {
		await expect(all(ndjson(bytes('{"a":1}\nnot json\n')))).rejects.toThrow(SyntaxError);
	});

	it('cancels the body when the reader stops early', async () => {
		let cancelled = false;
		const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
			start(c) {
				c.enqueue(new TextEncoder().encode('{"a":1}\n{"a":2}\n'));
			},
			cancel() {
				cancelled = true;
			}
		});
		for await (const v of ndjson(body)) {
			expect(v).toEqual({ a: 1 });
			break;
		}
		expect(cancelled).toBe(true);
	});
});
