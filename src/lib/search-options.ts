// Search options at the composer: what the next search covers and returns, and the one-line
// summary the collapsed control reads as ("3 data sources · summary on").
import { plural } from './format.js';

export interface SearchSettings {
	/** Data sources ticked, of `total` the user can search. */
	picked: number;
	total: number;
	summaryOn: boolean;
	topK: number;
	rerank: boolean;
	exact: boolean;
}

/** Results per search when the box is left alone. */
export const DEFAULT_TOP_K = 10;

/** The collapsed control's text: always sources and summary, then only what differs from the default. */
export function optionsSummary(s: SearchSettings): string {
	const sources =
		s.picked === 0
			? 'No data sources'
			: s.picked === s.total && s.total > 1
				? `All ${s.total} data sources`
				: `${s.picked} ${plural(s.picked, 'data source')}`;
	return [
		sources,
		`summary ${s.summaryOn ? 'on' : 'off'}`,
		...(s.topK !== DEFAULT_TOP_K ? [`${s.topK} results`] : []),
		...(s.rerank ? [] : ['no rerank']),
		...(s.exact ? ['exactly as typed'] : [])
	].join(' · ');
}
