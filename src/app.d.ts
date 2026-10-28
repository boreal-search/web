import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Failure } from '#lib/failure.js';
import type { Database } from '#lib/supabase/types.js';
import type { Theme } from '#lib/theme.js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** Validates the JWT against Supabase Auth before trusting the cookie session. */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
			/** Theme rendered into `<html data-theme>`: cookie, then the user's saved choice. */
			theme: Theme;
		}

		interface PageData {
			session: Session | null;
			user: User | null;
		}

		/** Besides `status` and `message`: what failed. Without it, the status decides. */
		interface Error {
			failure?: Failure;
		}

		// interface PageState {}
	}
}

export {};
