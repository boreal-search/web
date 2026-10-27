// Named types for the engine HTTP API (contract: boreal-search/infra/docs/architecture.md).
// Thin aliases over the generated `engine.openapi.ts` (`bun run gen:engine-client`); edit
// this file only to add or rename aliases, never to change shapes.
import type { components } from './engine.openapi';

type Schemas = components['schemas'];

export type Health = Schemas['Health'];
export type DataSource = Schemas['DataSourceOut'];
export type Document = Schemas['DocumentOut'];
export type DocumentPage = Schemas['DocumentPage'];
export type Job = Schemas['JobOut'];
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type SearchRequest = Schemas['SearchRequest'];
export type SearchResult = Schemas['SearchResult'];
export type Answer = Schemas['AnswerOut'];
export type AnswerSource = Schemas['AnswerSource'];
export type Verification = Schemas['VerificationOut'];
export type Claim = Schemas['ClaimOut'];
/** `answer` is present only when the request had `answer: true` (SearchAnswerResponse). */
export type SearchResponse = Schemas['SearchResponse'] & { answer?: Answer };

export interface EngineErrorBody {
	detail: string;
}
