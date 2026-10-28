// Newline-delimited JSON (application/x-ndjson): one JSON value per line. Shared by the server
// (reading the engine's /search/stream) and the browser (reading web's /search/stream).

/**
 * Parse a byte stream as NDJSON, yielding each value as its line completes. A partial last
 * line waits for the next chunk; blank lines are skipped; a final line without `\n` still
 * counts. Values are not validated: `T` is the caller's claim about the producer. A line that
 * isn't JSON throws (SyntaxError), as does an aborted stream. Stopping early cancels the body.
 */
export async function* ndjson<T>(body: ReadableStream<Uint8Array<ArrayBuffer>>): AsyncGenerator<T> {
	// getReader, not `for await`: Safari's ReadableStream isn't async-iterable everywhere yet.
	const reader = body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';
	let done = false;
	try {
		while (!done) {
			const chunk = await reader.read();
			done = chunk.done;
			buffer += chunk.value ?? '';
			const lines = buffer.split('\n');
			buffer = done ? '' : (lines.pop() ?? '');
			for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
		}
	} finally {
		if (!done) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
