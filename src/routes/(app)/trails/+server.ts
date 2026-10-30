// The trail list now lives in the search screen's sidebar; old /trails links land there.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => redirect(308, resolve('/(app)/search'));
