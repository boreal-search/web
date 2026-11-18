import { fail } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	accessRequestEmail,
	loadAccessRequest,
	parseAccessRequest,
	type AccessRequestField
} from '#lib/server/access-requests.js';
import { requireUser } from '#lib/server/auth.js';
import { EmailError, sendEmail } from '#lib/server/email.js';
import type { Actions, PageServerLoad } from './$types';

// Request access for an organization's documents. The request is saved with the user's
// session (RLS: own rows only, one open at a time), then support is emailed. Founders act on
// it from /admin: create the org, invite the user, mark the request done.

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser();
	return {
		email: user.email ?? null,
		accessRequest: await loadAccessRequest(locals.supabase, user.id)
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url, fetch }) => {
		const user = requireUser();
		const parsed = parseAccessRequest(await request.formData());
		if (!parsed.ok) return fail(400, { values: parsed.values, errors: parsed.errors });
		const { organization, role, useCase } = parsed.value;

		const { data, error } = await locals.supabase
			.from('access_requests')
			.insert({ user_id: user.id, organization, role, use_case: useCase })
			.select('email')
			.single();
		// Already open (another tab, a double submit): the reloaded page shows that one.
		if (error?.code === '23505') return { sent: true };
		if (error) {
			return fail(400, {
				values: { organization, role: role ?? '', useCase },
				errors: {} as Partial<Record<AccessRequestField, string>>,
				error: `Your request wasn't saved (${error.message}). Try again.`
			});
		}

		try {
			await sendEmail(
				accessRequestEmail(
					{ email: data.email, ...parsed.value },
					`${url.origin}${resolve('/(site)/admin')}`
				),
				fetch
			);
			return { sent: true };
		} catch (e) {
			// Saved either way: founders also see open requests on /admin.
			console.error('access request email failed', e instanceof EmailError ? e.message : e);
			return { sent: true, partial: true };
		}
	}
};
