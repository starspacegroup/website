import { describe, expect, it, vi } from 'vitest';
import {
	buildAuthorizeUrl,
	callbackUrl,
	CONNECT_SCOPES,
	exchangeCode,
	generateState,
	readConnectClient,
	timingSafeEqual
} from './spacebot-connect';

const client = {
	clientId: 'starspace-website',
	clientSecret: 'sbcs_secret',
	spacebotUrl: 'https://spacebot.starspace.group'
};

function platform(env: Record<string, string | undefined>) {
	return { env } as unknown as App.Platform;
}

describe('readConnectClient', () => {
	it('reads a complete registration', () => {
		const result = readConnectClient(
			platform({
				SPACEBOT_CONNECT_CLIENT_ID: 'site',
				SPACEBOT_CONNECT_CLIENT_SECRET: 'secret',
				SPACEBOT_CONNECT_URL: 'https://spacebot.starspace.group/'
			})
		);

		expect(result).toEqual({
			clientId: 'site',
			clientSecret: 'secret',
			spacebotUrl: 'https://spacebot.starspace.group'
		});
	});

	it('returns null when any half is missing, so no dead button is offered', () => {
		expect(
			readConnectClient(
				platform({ SPACEBOT_CONNECT_CLIENT_ID: 'site', SPACEBOT_CONNECT_URL: 'https://x.test' })
			)
		).toBeNull();
		expect(readConnectClient(platform({}))).toBeNull();
		expect(readConnectClient(undefined)).toBeNull();
	});

	it('returns null for an unparseable SpaceBot address', () => {
		expect(
			readConnectClient(
				platform({
					SPACEBOT_CONNECT_CLIENT_ID: 'site',
					SPACEBOT_CONNECT_CLIENT_SECRET: 'secret',
					SPACEBOT_CONNECT_URL: 'not a url'
				})
			)
		).toBeNull();
	});
});

describe('generateState', () => {
	it('is long and does not repeat', () => {
		const a = generateState();
		expect(a).toHaveLength(64);
		expect(a).not.toBe(generateState());
	});
});

describe('timingSafeEqual', () => {
	it('matches equal values and rejects everything else', () => {
		expect(timingSafeEqual('abc', 'abc')).toBe(true);
		expect(timingSafeEqual('abc', 'abd')).toBe(false);
		expect(timingSafeEqual('abc', 'abcd')).toBe(false);
		expect(timingSafeEqual(undefined as unknown as string, 'abc')).toBe(false);
	});
});

describe('buildAuthorizeUrl', () => {
	it('asks for exactly the two scopes the hero needs', () => {
		const url = new URL(buildAuthorizeUrl(client, callbackUrl('https://starspace.group'), 'st'));

		expect(url.origin).toBe('https://spacebot.starspace.group');
		expect(url.pathname).toBe('/connect');
		expect(url.searchParams.get('scope')).toBe(CONNECT_SCOPES.join(' '));
		expect(url.searchParams.get('state')).toBe('st');
		expect(url.searchParams.get('redirect_uri')).toBe(
			'https://starspace.group/admin/spacebot/callback'
		);
	});
});

describe('exchangeCode', () => {
	it('posts the secret and the same redirect_uri, and returns the key', async () => {
		const fetcher = vi.fn(async () =>
			new Response(
				JSON.stringify({ api_key: 'sb_live_abc', guild_id: '123', scopes: ['voice:read'] }),
				{ status: 200 }
			)
		);

		const result = await exchangeCode(client, 'sbc_code', 'https://starspace.group/cb', fetcher);

		expect(result).toEqual({
			ok: true,
			apiKey: 'sb_live_abc',
			guildId: '123',
			scopes: ['voice:read']
		});

		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://spacebot.starspace.group/api/v1/connect/exchange');
		expect(JSON.parse(String(init.body))).toMatchObject({
			client_id: 'starspace-website',
			client_secret: 'sbcs_secret',
			code: 'sbc_code',
			redirect_uri: 'https://starspace.group/cb'
		});
	});

	it('reports a refusal rather than pretending it worked', async () => {
		const fetcher = vi.fn(async () =>
			new Response(JSON.stringify({ error: 'Invalid client credentials' }), { status: 401 })
		);

		const result = await exchangeCode(client, 'sbc_code', 'https://starspace.group/cb', fetcher);
		expect(result).toEqual({ ok: false, error: 'Invalid client credentials' });
	});

	it('rejects a 200 that carries no usable key', async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify({ guild_id: '1' }), { status: 200 }));
		const result = await exchangeCode(client, 'c', 'https://starspace.group/cb', fetcher);
		expect(result.ok).toBe(false);
	});

	it('survives an unreachable SpaceBot and unreadable output', async () => {
		const dead = vi.fn(async () => {
			throw new Error('network');
		});
		expect((await exchangeCode(client, 'c', 'https://x.test/cb', dead)).ok).toBe(false);

		const garbage = vi.fn(async () => new Response('<html>', { status: 200 }));
		expect((await exchangeCode(client, 'c', 'https://x.test/cb', garbage)).ok).toBe(false);
	});
});
