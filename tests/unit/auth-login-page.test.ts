import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Auth Login Page Server
 * TDD: Testing the login page server-side logic
 */

// Mock SvelteKit redirect
const mockRedirect = vi.fn((status: number, location: string) => {
	const err = new Error('Redirect') as Error & { status: number; location: string };
	err.status = status;
	err.location = location;
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => mockRedirect(status, location)
}));

describe('Auth Login Page Server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load function', () => {
		/**
		 * These used to assert a redirect to the home page. Being bounced there
		 * with nothing said is indistinguishable from a sign-in that failed, and
		 * it was reported as exactly that by someone whose session was valid the
		 * whole time. The page now says so instead.
		 */
		it('tells a signed-in visitor they are signed in, rather than moving them', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const result = (await load({
				locals: {
					user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
				},
				url: new URL('http://localhost/auth/login')
			} as any)) as any;

			expect(result.signedInAs).toMatchObject({ lacksAccess: false, canOpenAdmin: false });
		});

		it('says plainly when they were sent here from a page they cannot open', async () => {
			// Signing in again would not help, so the page must not imply it would.
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const result = (await load({
				locals: {
					user: { id: '1', login: 'user', email: 'user@test.com', isOwner: false }
				},
				url: new URL('http://localhost/auth/login?error=unauthorized')
			} as any)) as any;

			expect(result.signedInAs.lacksAccess).toBe(true);
		});

		it('does not offer the admin link to someone who would be bounced back', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const plain = (await load({
				locals: { user: { id: '1', login: 'u', email: 'u@t.com', isOwner: false } },
				url: new URL('http://localhost/auth/login')
			} as any)) as any;
			const admin = (await load({
				locals: { user: { id: '2', login: 'a', email: 'a@t.com', isAdmin: true } },
				url: new URL('http://localhost/auth/login')
			} as any)) as any;

			expect(plain.signedInAs.canOpenAdmin).toBe(false);
			expect(admin.signedInAs.canOpenAdmin).toBe(true);
		});

		it('should return configuredProviders for non-logged-in user', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login');

			const result = await load({
				locals: {},
				url: mockUrl
			} as any);

			expect(result).toEqual({
				signedInAs: null,
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: false,
					discord: false
				},
				devAuthSimulationEnabled: false
			});
		});

		it('should return configuredProviders for non-logged-in user even with error param', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const mockUrl = new URL('http://localhost/auth/login?error=unauthorized');

			const result = await load({
				locals: { user: null },
				url: mockUrl
			} as any);

			expect(result).toEqual({
				signedInAs: null,
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: false,
					discord: false
				},
				devAuthSimulationEnabled: false
			});
		});

		it('should expose simulated providers when DEV_AUTH_BYPASS is enabled', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const result = await load({
				locals: { user: null },
				url: new URL('http://localhost/auth/login'),
				platform: {
					env: {
						DEV_AUTH_BYPASS: 'true'
					}
				}
			} as any);

			expect(result).toEqual({
				signedInAs: null,
				configuredProviders: {
					github: false,
					discord: false
				},
				simulatedProviders: {
					github: true,
					discord: true
				},
				devAuthSimulationEnabled: true
			});
		});

		it('names the owner and offers them the admin area', async () => {
			const { load } = await import('../../src/routes/auth/login/+page.server');

			const result = (await load({
				locals: {
					user: {
						id: '1',
						login: 'owner',
						githubLogin: 'owner',
						email: 'owner@test.com',
						isOwner: true
					}
				},
				url: new URL('http://localhost/auth/login')
			} as any)) as any;

			expect(result.signedInAs).toMatchObject({ name: 'owner', canOpenAdmin: true });
		});
	});
});
