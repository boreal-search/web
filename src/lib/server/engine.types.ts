// Named types for the engine HTTP API (contract: boreal-search/infra/docs/architecture.md).
// Thin aliases over the generated `engine.openapi.ts` (`bun run gen:engine-client`); edit
// this file only to add or rename aliases, never to change shapes.
import type { components } from './engine.openapi';

type Schemas = components['schemas'];

export type DataSource = Schemas['DataSourceOut'];
export type Document = Schemas['DocumentOut'];
export type DocumentPage = Schemas['DocumentPage'];
export type Job = Schemas['JobOut'];
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type SearchRequest = Schemas['SearchRequest'];
export type ContextStep = Schemas['ContextStep'];
export type Scope = Schemas['Scope'];
export type SearchReadout = Schemas['SearchReadout'];
/** The engine's reading of a question (2.0+): its intent and the parts searched on their own. */
export type Plan = Schemas['PlanOut'];
export type AnswerReadout = Schemas['AnswerReadout'];
export type SearchResult = Schemas['SearchResult'];
export type Answer = Schemas['AnswerOut'];
export type Citation = Schemas['CitationOut'];
/** Whether the check found the cited page supports the sentence. */
export type CitationStatus = Citation['status'];
export type Highlight = Schemas['HighlightOut'];
/** `answer` is present only when the request had `answer: true` (SearchAnswerResponse). */
export type SearchResponse = Schemas['SearchResponse'] & { answer?: Answer };

export interface EngineErrorBody {
	detail: string;
}
