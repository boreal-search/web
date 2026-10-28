import { describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	RESEND_API_KEY: 're_test_key' as string | undefined,
	EMAIL_FROM: 'Boreal Search <support@borealsearch.app>' as string | undefined
}));
vi.mock('$app/env/private', () => env);

const { EmailError, sendEmail } = await import('./email');

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const email = { to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('sendEmail', () => {
	it('POSTs the message to Resend with the bearer key and returns the id', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(200, { id: 'msg_1' }));
		expect(await sendEmail(email, f as typeof fetch)).toEqual({ id: 'msg_1' });

		const [url, init] = f.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({
			authorization: 'Bearer re_test_key',
			'content-type': 'application/json'
		});
		expect(JSON.parse(init.body as string)).toEqual({
			from: 'Boreal Search <support@borealsearch.app>',
			to: 'a@example.com',
			subject: 'Hi',
			html: '<p>Hi</p>',
			text: 'Hi'
		});
	});

	it("raises EmailError with Resend's status and message", async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(
				json(422, { statusCode: 422, name: 'validation_error', message: 'bad to' })
			);
		const err = await sendEmail(email, f as typeof fetch).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(EmailError);
		expect(err).toMatchObject({ status: 422, message: 'Resend 422: bad to' });
	});

	it('raises EmailError when the network call fails', async () => {
		const f = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'));
		await expect(sendEmail(email, f as typeof fetch)).rejects.toMatchObject({
			status: 0,
			message: 'Resend unreachable: fetch failed'
		});
	});

	it('throws a clear error without calling Resend when unconfigured', async () => {
		env.RESEND_API_KEY = undefined;
		const f = vi.fn();
		try {
			await expect(sendEmail(email, f as typeof fetch)).rejects.toThrow(
				'Email is not configured: set RESEND_API_KEY and EMAIL_FROM'
			);
			expect(f).not.toHaveBeenCalled();
		} finally {
			env.RESEND_API_KEY = 're_test_key';
		}
	});

	it('never puts the API key in error messages', async () => {
		const f = vi.fn().mockResolvedValueOnce(json(401, { message: 'API key is invalid' }));
		const err = await sendEmail(email, f as typeof fetch).catch((e: unknown) => e);
		expect(String((err as Error).message)).not.toContain('re_test_key');
	});
});
