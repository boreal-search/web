import type { SupabaseClient } from '@supabase/supabase-js';
import type { Failure } from '#lib/failure.js';
import type { Database } from '#lib/supabase/types.js';
import type { Theme } from '#lib/theme.js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** From the verified session JWT; Supabase Auth confirms the session before any response
			 * or write (hooks.server.ts). */
			user: { id: string; email: string | undefined } | null;
			/** Theme rendered into `<html data-theme>`: cookie, then the user's saved choice. */
			theme: Theme;
		}

		/** Besides `status` and `message`: what failed. Without it, the status decides. */
		interface Error {
			failure?: Failure;
		}

		/** Shallow history entries (`pushState`): the search screen's evidence overlay on medium and
		 * small screens, so Back (button or gesture) closes it. */
		interface PageState {
			evidence?: boolean;
		}
	}
}

export {};
