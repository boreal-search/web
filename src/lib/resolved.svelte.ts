/**
 * The latest value a streamed load promise resolved to, for script code that can't sit in an
 * `{#await}` (titles, lookups). Undefined until the first resolves; a newer promise replaces
 * it once that one resolves. `get` must return a promise that never rejects (`settle`).
 */
export class Resolved<T> {
	current = $state.raw<T>();

	constructor(get: () => Promise<T>) {
		$effect(() => {
			let live = true;
			void get().then((value) => {
				if (live) this.current = value;
			});
			return () => {
				live = false;
			};
		});
	}
}
