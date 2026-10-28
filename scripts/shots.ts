// Screenshot pages as the test user, light and dark, desktop and phone, against a running dev server.
//   bun scripts/shots.ts [route ...]      e.g. bun scripts/shots.ts / /search "/search?q=fish habitat" /admin
// A route `/search?q=…` submits the search form with that query. Routes starting with `anon:` are
// shot logged out (`anon:/login`). Logs in as SHOTS_AS=platform-admin|org-admin|member (default
// org-admin) with TEST_<ROLE>_EMAIL / TEST_<ROLE>_PASSWORD from .env (bun loads it).
// Output: .shots/<role>/<route>-<scheme>-<width>.png (git-ignored).
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.SHOTS_BASE ?? 'http://localhost:5173';
const out = `.shots/${(process.env.SHOTS_AS ?? 'org-admin').toLowerCase()}`;
const routes = process.argv.slice(2);
if (routes.length === 0)
	routes.push('anon:/login', 'anon:/signup', 'anon:/forgot', '/', '/search', '/account', '/admin');

const role = (process.env.SHOTS_AS ?? 'org-admin').toUpperCase().replace('-', '_');
const email = process.env[`TEST_${role}_EMAIL`];
const password = process.env[`TEST_${role}_PASSWORD`];
if (!email || !password)
	throw new Error(`Set TEST_${role}_EMAIL and TEST_${role}_PASSWORD in .env`);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

async function logIn(page: Page) {
	await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
	await page.fill('input[name=email]', email!);
	await page.fill('input[name=password]', password!);
	await Promise.all([
		page.waitForURL((u) => u.pathname !== '/login', { waitUntil: 'commit' }),
		page.click('main button[type=submit]')
	]);
}

async function visit(page: Page, route: string) {
	const url = new URL(route, base);
	const query = url.pathname === '/search' ? url.searchParams.get('q') : null;
	await page.goto(`${base}${url.pathname}`, { waitUntil: 'networkidle' });
	if (query) {
		await page.fill('input[name=query]', query);
		await page.click('main button[type=submit]');
		// The step streams in; it carries data-step-done once its summary and readout are final.
		await page.waitForSelector('[data-step-done]', { timeout: 180_000 });
		// Let the page render the result, then let lazy page images load.
		await page.waitForTimeout(500);
		for (const img of await page.locator('main img').all()) await img.scrollIntoViewIfNeeded();
		await page.waitForTimeout(1500);
	}
	await page.waitForLoadState('networkidle');
}

const name = (route: string) =>
	route
		.replace(/^anon:/, 'anon-')
		.replace(/[^a-z0-9-]+/gi, '_')
		.replace(/^_|_$/g, '') || 'home';

for (const scheme of ['light', 'dark'] as const) {
	for (const width of [1280, 390]) {
		const context = await browser.newContext({
			colorScheme: scheme,
			viewport: { width, height: 900 }
		});
		const page = await context.newPage();
		let loggedIn = false;
		for (const route of routes) {
			const anon = route.startsWith('anon:');
			if (!anon && !loggedIn) {
				await logIn(page);
				loggedIn = true;
			}
			const target = anon ? route.slice(5) : route;
			const ctx = anon
				? await browser.newContext({ colorScheme: scheme, viewport: { width, height: 900 } })
				: null;
			const p = ctx ? await ctx.newPage() : page;
			await visit(p, target);
			const file = `${out}/${name(route)}-${scheme}-${width}.png`;
			await p.screenshot({ path: file, fullPage: true });
			console.log(file);
			await ctx?.close();
		}
		await context.close();
	}
}
await browser.close();
