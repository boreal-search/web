// Hand-written types for the engine HTTP API (see boreal-search/infra/docs/architecture.md).
// Once the engine is running, `bun run gen:engine-client` regenerates this file from
// $ENGINE_URL/openapi.json via openapi-typescript. Until then, keep it in sync by hand.

export type DataSourceStatus = 'active';
export type DocumentStatus = 'queued' | 'rendering' | 'embedding' | 'ready' | 'failed';
export type JobType = 'render' | 'embed' | 'index';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Health {
	status: 'ok';
	version: string;
	embedder: string;
	embedding_dim: number;
}

export interface DataSource {
	id: string;
	name: string;
	description: string | null;
	status: DataSourceStatus;
	document_count: number;
	page_count: number;
	created_at: string;
}

export interface Document {
	id: string;
	data_source_id: string;
	title: string;
	filename: string;
	page_count: number | null;
	status: DocumentStatus;
	/** Presigned, short-lived. */
	pdf_url: string;
	created_at: string;
}

export interface DocumentPage {
	items: Document[];
	total: number;
}

export interface SearchRequest {
	query: string;
	data_source_ids: string[];
	top_k?: number;
	rerank?: boolean;
}

export interface SearchResult {
	document_id: string;
	document_title: string;
	data_source_id: string;
	page_number: number;
	score: number;
	/** Presigned, short-lived. */
	page_image_url: string;
	/** Presigned, short-lived; ends with `#page=<n>`. */
	pdf_url: string;
	snippet: string | null;
}

export interface SearchResponse {
	query: string;
	results: SearchResult[];
	retrieval_ms: number;
	reranked: boolean;
}

export interface Job {
	id: string;
	type: JobType;
	status: JobStatus;
	progress: { done: number; total: number } | null;
	error: string | null;
	created_at: string;
	finished_at: string | null;
}

export interface EngineErrorBody {
	detail: string;
}
