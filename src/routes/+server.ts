import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';

/** Signed in, `/` is search; signed out, the splash. */
export const GET: RequestHandler = ({ locals }) =>
	redirect(303, locals.user ? resolve('/(app)/search') : resolve('/(site)/welcome'));
