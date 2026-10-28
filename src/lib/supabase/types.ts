// Hand-written Database type for the control-plane schema in supabase/migrations.
// Regenerate with `supabase gen types typescript --linked > src/lib/supabase/types.ts`
// once the project is linked; keep the shape in sync with the migrations.

export type OrgRole = 'admin' | 'member';
export type SearchStatus =
	'ok' | 'forbidden' | 'timeout' | 'unreachable' | 'unavailable' | 'engine_error';
/** `add_org_member` result: the email had an account (member row) or not (pending invite). */
export type AddMemberResult = 'added' | 'invited';

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
				Row: {
					id: string;
					slug: string;
					name: string;
					log_queries: boolean;
					default_role: OrgRole;
					created_at: string;
				};
				Insert: {
					id?: string;
					slug: string;
					name: string;
					log_queries?: boolean;
					default_role?: OrgRole;
					created_at?: string;
				};
				Update: { slug?: string; name?: string; log_queries?: boolean; default_role?: OrgRole };
				Relationships: [];
			};
			org_members: {
				Row: { org_id: string; user_id: string; role: OrgRole; created_at: string };
				Insert: { org_id: string; user_id: string; role?: OrgRole; created_at?: string };
				Update: { role?: OrgRole };
				Relationships: [
					{
						foreignKeyName: 'org_members_org_id_fkey';
						columns: ['org_id'];
						isOneToOne: false;
						referencedRelation: 'orgs';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'org_members_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			org_data_sources: {
				Row: { org_id: string; data_source_id: string; created_at: string };
				Insert: { org_id: string; data_source_id: string; created_at?: string };
				Update: Record<string, never>;
				Relationships: [
					{
						foreignKeyName: 'org_data_sources_org_id_fkey';
						columns: ['org_id'];
						isOneToOne: false;
						referencedRelation: 'orgs';
						referencedColumns: ['id'];
					}
				];
			};
			platform_admins: {
				Row: { user_id: string; created_at: string };
				Insert: { user_id: string; created_at?: string };
				Update: Record<string, never>;
				Relationships: [];
			};
			org_invites: {
				Row: {
					org_id: string;
					email: string;
					role: OrgRole;
					invited_by: string | null;
					created_at: string;
				};
				Insert: {
					org_id: string;
					email: string;
					role?: OrgRole;
					invited_by?: string | null;
					created_at?: string;
				};
				Update: { role?: OrgRole };
				Relationships: [
					{
						foreignKeyName: 'org_invites_org_id_fkey';
						columns: ['org_id'];
						isOneToOne: false;
						referencedRelation: 'orgs';
						referencedColumns: ['id'];
					}
				];
			};
			org_domains: {
				Row: { org_id: string; domain: string; created_at: string };
				Insert: { org_id: string; domain: string; created_at?: string };
				Update: Record<string, never>;
				Relationships: [
					{
						foreignKeyName: 'org_domains_org_id_fkey';
						columns: ['org_id'];
						isOneToOne: false;
						referencedRelation: 'orgs';
						referencedColumns: ['id'];
					}
				];
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
		Functions: {
			is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
			is_org_member: { Args: { p_org_id: string }; Returns: boolean };
			is_org_admin: { Args: { p_org_id: string }; Returns: boolean };
			add_org_member: {
				Args: { p_org_id: string; p_email: string; p_role: OrgRole };
				Returns: AddMemberResult;
			};
		};
		Enums: { org_role: OrgRole; search_status: SearchStatus };
		CompositeTypes: Record<string, never>;
	};
}
