// Hand-written Database type for the control-plane schema in supabase/migrations.
// Regenerate with `supabase gen types typescript --linked > src/lib/supabase/types.ts`
// once the project is linked; keep the shape in sync with the migrations.

export type OrgRole = 'admin' | 'member';
export type SearchStatus =
	'ok' | 'forbidden' | 'timeout' | 'unreachable' | 'unavailable' | 'engine_error';
/** `add_org_member` result: the email had an account (member row) or not (pending invite). */
export type AddMemberResult = 'added' | 'invited';
export type AccessRequestStatus = 'open' | 'done';
export type TrailRelation = 'owner' | 'shared' | 'member';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					email: string;
					display_name: string | null;
					theme: 'system' | 'light' | 'dark';
					created_at: string;
				};
				Insert: {
					id: string;
					email: string;
					display_name?: string | null;
					theme?: 'system' | 'light' | 'dark';
					created_at?: string;
				};
				Update: {
					email?: string;
					display_name?: string | null;
					theme?: 'system' | 'light' | 'dark';
				};
				Relationships: [];
			};
			orgs: {
				Row: {
					id: string;
					slug: string;
					name: string;
					log_queries: boolean;
					/** Off: no trails are stored for this org (separate from log_queries). */
					conversation_history: boolean;
					default_role: OrgRole;
					created_at: string;
				};
				Insert: {
					id?: string;
					slug: string;
					name: string;
					log_queries?: boolean;
					conversation_history?: boolean;
					default_role?: OrgRole;
					created_at?: string;
				};
				Update: {
					slug?: string;
					name?: string;
					log_queries?: boolean;
					conversation_history?: boolean;
					default_role?: OrgRole;
				};
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
			public_data_sources: {
				Row: { data_source_id: string; created_at: string };
				Insert: { data_source_id: string; created_at?: string };
				Update: Record<string, never>;
				Relationships: [];
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
			access_requests: {
				Row: {
					id: string;
					user_id: string;
					/** Copied from the requester's profile at insert. */
					email: string;
					organization: string;
					role: string | null;
					use_case: string;
					status: AccessRequestStatus;
					created_at: string;
				};
				/** `user_id` defaults to the caller; `email` and `created_at` are set by a trigger. */
				Insert: {
					id?: string;
					user_id?: string;
					email?: string;
					organization: string;
					role?: string | null;
					use_case: string;
					status?: 'open';
					created_at?: string;
				};
				/** Platform admins only, and only `status`. */
				Update: { status?: AccessRequestStatus };
				Relationships: [
					{
						foreignKeyName: 'access_requests_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'profiles';
						referencedColumns: ['id'];
					}
				];
			};
			search_events: {
				Row: {
					id: string;
					/** null: a search in the Public context. */
					org_id: string | null;
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
					org_id?: string | null;
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
			trails: {
				Row: {
					id: string;
					/** null: the Public context. */
					org_id: string | null;
					user_id: string;
					title: string;
					created_at: string;
					updated_at: string;
				};
				/** `user_id` defaults to the caller. */
				Insert: {
					id?: string;
					org_id: string | null;
					user_id?: string;
					title: string;
				};
				Update: { title?: string };
				Relationships: [
					{
						foreignKeyName: 'trails_org_id_fkey';
						columns: ['org_id'];
						isOneToOne: false;
						referencedRelation: 'orgs';
						referencedColumns: ['id'];
					}
				];
			};
			trail_shares: {
				Row: { trail_id: string; user_id: string; created_at: string };
				Insert: { trail_id: string; user_id: string };
				Update: Record<string, never>;
				Relationships: [
					{
						foreignKeyName: 'trail_shares_trail_id_fkey';
						columns: ['trail_id'];
						isOneToOne: false;
						referencedRelation: 'trails';
						referencedColumns: ['id'];
					}
				];
			};
			trail_steps: {
				Row: {
					id: string;
					trail_id: string;
					n: number;
					query: string;
					resolved_query: string;
					rewrite: boolean;
					scope: Json;
					builds_on: number | null;
					results: Json;
					answer: Json | null;
					readout: Json;
					created_at: string;
				};
				/** `n` and `created_at` are set by a trigger (pass any `n`, e.g. 0). */
				Insert: {
					id?: string;
					trail_id: string;
					n: number;
					query: string;
					resolved_query: string;
					rewrite?: boolean;
					scope: Json;
					builds_on?: number | null;
					results: Json;
					answer?: Json | null;
					readout: Json;
				};
				/** Completing a step: the summary once, and the final readout. */
				Update: { answer?: Json | null; readout?: Json };
				Relationships: [
					{
						foreignKeyName: 'trail_steps_trail_id_fkey';
						columns: ['trail_id'];
						isOneToOne: false;
						referencedRelation: 'trails';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			org_search_daily: {
				Row: {
					/** null: the Public context (visible to platform admins only). */
					org_id: string | null;
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
			owns_trail: { Args: { p_trail_id: string }; Returns: boolean };
			can_read_trail: { Args: { p_trail_id: string }; Returns: boolean };
			can_write_trail: { Args: { p_trail_id: string }; Returns: boolean };
			keeps_trails: { Args: { p_org_id: string | null }; Returns: boolean };
			/** Owner, shares, and (to the owner only) org members it could be shared with. */
			trail_people: {
				Args: { p_trail_id: string };
				Returns: {
					user_id: string;
					email: string;
					display_name: string | null;
					relation: TrailRelation;
				}[];
			};
			add_org_member: {
				Args: { p_org_id: string; p_email: string; p_role: OrgRole };
				Returns: AddMemberResult;
			};
			admin_last_sign_ins: {
				Args: { p_user_ids: string[] };
				Returns: { user_id: string; last_sign_in_at: string | null }[];
			};
		};
		Enums: { org_role: OrgRole; search_status: SearchStatus };
		CompositeTypes: Record<string, never>;
	};
}
