// Hand-written Database type for the control-plane schema in supabase/migrations.
// Regenerate with `supabase gen types typescript --linked > src/lib/supabase/types.ts`
// once the project is linked; keep the shape in sync with the migrations.

export type OrgRole = 'owner' | 'member';

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
				Row: { id: string; slug: string; name: string; created_at: string };
				Insert: { id?: string; slug: string; name: string; created_at?: string };
				Update: { slug?: string; name?: string };
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
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: { org_role: OrgRole };
		CompositeTypes: Record<string, never>;
	};
}
