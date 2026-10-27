// Hand-written Database type for the control-plane schema in supabase/migrations.
// Regenerate with `supabase gen types typescript --linked > src/lib/supabase/types.ts`
// once the project is linked; keep the shape in sync with the migrations.

export type OrgRole = 'owner' | 'member';
export type SearchStatus = 'ok' | 'forbidden' | 'engine_error';

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: { id: string; email: string; display_name: string | null; created_at: string };
				Insert: { id: string; email: string; display_name?: string | null; created_at?: string };
				Update: { email?: string; display_name?: string | null };
				Relationships: [];
			};
			orgs: {
				Row: { id: string; slug: string; name: string; log_queries: boolean; created_at: string };
				Insert: {
					id?: string;
					slug: string;
					name: string;
					log_queries?: boolean;
					created_at?: string;
				};
				Update: { slug?: string; name?: string; log_queries?: boolean };
				Relationships: [];
			};
			org_members: {
				Row: { org_id: string; user_id: string; role: OrgRole; created_at: string };
				Insert: { org_id: string; user_id: string; role?: OrgRole; created_at?: string };
				Update: { role?: OrgRole };
				Relationships: [];
			};
			org_data_sources: {
				Row: { org_id: string; data_source_id: string; created_at: string };
				Insert: { org_id: string; data_source_id: string; created_at?: string };
				Update: Record<string, never>;
				Relationships: [];
			};
			search_events: {
				Row: {
					id: string;
					org_id: string;
					user_id: string | null;
					data_source_ids: string[];
					query: string | null;
					query_length: number;
					top_k: number;
					rerank: boolean;
					status: SearchStatus;
					result_count: number | null;
					top_score: number | null;
					retrieval_ms: number | null;
					reranked: boolean | null;
					error: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					org_id: string;
					user_id?: string | null;
					data_source_ids: string[];
					query?: string | null;
					query_length: number;
					top_k: number;
					rerank: boolean;
					status: SearchStatus;
					result_count?: number | null;
					top_score?: number | null;
					retrieval_ms?: number | null;
					reranked?: boolean | null;
					error?: string | null;
					created_at?: string;
				};
				Update: Record<string, never>;
				Relationships: [];
			};
		};
		Views: {
			org_search_daily: {
				Row: {
					org_id: string;
					day: string;
					searches: number;
					ok: number;
					engine_errors: number;
					zero_result: number;
					active_users: number;
					p50_retrieval_ms: number | null;
					p95_retrieval_ms: number | null;
				};
				Relationships: [];
			};
		};
		Functions: Record<string, never>;
		Enums: { org_role: OrgRole; search_status: SearchStatus };
		CompositeTypes: Record<string, never>;
	};
}
