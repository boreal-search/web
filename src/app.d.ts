import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '#lib/supabase/types.js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** Validates the JWT against Supabase Auth before trusting the cookie session. */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}

		interface PageData {
			session: Session | null;
			user: User | null;
		}

		// interface Error {}
		// interface PageState {}
	}
}

export {};
