import { createAuthSession, getAuthSession } from '$lib/utils/db';
import { buildSessionCookieHeader } from '$lib/utils/session';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type SupportedProvider = 'github' | 'discord';
type SimulatedRole = 'user' | 'admin' | 'superadmin';
type SimulatedMode = 'login' | 'link';

function parseProvider(value: string | null): SupportedProvider | null {
	if (value === 'github' || value === 'discord') {
		return value;
	}

	return null;
}

function parseRole(value: string | null): SimulatedRole {
	if (value === 'admin' || value === 'superadmin') {
		return value;
	}

	return 'user';
}

function parseMode(value: string | null): SimulatedMode {
	if (value === 'link') {
		return 'link';
	}

	return 'login';
}

function buildDevUser(provider: SupportedProvider, role: SimulatedRole) {
	const suffix = crypto.randomUUID().slice(0, 8);
	const loginPrefix = provider === 'github' ? 'dev-github' : 'dev-discord';
	const login = `${loginPrefix}-${suffix}`;
	const isSuperadmin = role === 'superadmin';
	const isAdmin = role === 'admin' || isSuperadmin;
	const namePrefix = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'User';

	return {
		id: `dev-${provider}-${suffix}`,
		login,
		email: `${login}@example.dev`,
		name: provider === 'github' ? `GitHub Dev ${namePrefix}` : `Discord Dev ${namePrefix}`,
		avatarUrl: undefined,
		isOwner: isSuperadmin,
		isAdmin,
		isPretend: true,
		simulatedConnections: [provider],
		githubLogin: provider === 'github' ? login : undefined
	};
}

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	if (!isDevAuthSimulationEnabled(url, platform)) {
		throw redirect(302, '/auth/login?error=not_configured');
	}

	// The simulator still mints a real server-side session (its payload is trusted
	// exactly like a real login's), so it needs the database like any other login.
	const db = platform?.env?.DB;
	if (!db) {
		throw redirect(302, '/auth/login?error=not_configured');
	}

	const provider = parseProvider(url.searchParams.get('provider'));
	if (!provider) {
		throw redirect(302, '/auth/login?error=oauth_failed');
	}

	const mode = parseMode(url.searchParams.get('mode'));
	if (mode === 'link') {
		const existingUser = await getAuthSession(db, cookies.get('session') ?? '');

		if (existingUser?.isPretend) {
			const simulatedConnections = Array.from(
				new Set([...(existingUser.simulatedConnections || []), provider])
			);

			const linkedSessionId = await createAuthSession(db, {
				...existingUser,
				simulatedConnections
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: new URL(`/profile?linked=${provider}`, url.origin).toString(),
					'Set-Cookie': buildSessionCookieHeader(linkedSessionId, url)
				}
			});
		}
	}

	const role = parseRole(url.searchParams.get('role'));
	const sessionUser = buildDevUser(provider, role);
	const redirectTarget = role === 'admin' || role === 'superadmin' ? '/admin' : '/';

	// `sessions.user_id` is a foreign key into `users`, so the row has to exist
	// before the session can. The simulator invents an id per run and used to go
	// straight to createAuthSession, which meant every simulated login died on a
	// FOREIGN KEY constraint and the whole local admin surface was unreachable.
	//
	// `is_admin` is written because authHandler re-reads privileges from this
	// table on every request rather than trusting the session payload: without
	// it a simulated admin is demoted on its very next page load. Ownership is
	// not written here — that is resolved separately, and a dev row must not be
	// able to claim it in a database that has a real owner.
	await db
		.prepare(
			`INSERT INTO users (id, email, name, is_admin) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, is_admin = excluded.is_admin`
		)
		.bind(sessionUser.id, sessionUser.email, sessionUser.name, sessionUser.isAdmin ? 1 : 0)
		.run();

	const sessionId = await createAuthSession(db, sessionUser);

	return new Response(null, {
		status: 302,
		headers: {
			Location: new URL(redirectTarget, url.origin).toString(),
			'Set-Cookie': buildSessionCookieHeader(sessionId, url)
		}
	});
};
