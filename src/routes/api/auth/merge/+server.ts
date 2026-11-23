import {
	clearFailures,
	clientAddress,
	isThrottled,
	recordFailure,
	throttleStore
} from '$lib/server/login-throttle';
import { mergeAccounts } from '$lib/services/account-merge';
import { hashPassword, verifyPassword } from '$lib/utils/passwords';
import { getUserAuthState } from '$lib/utils/user-auth-state';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface MergeUserRecord {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
	password_hash: string | null;
}

// Spent on an unknown account so a miss costs the same PBKDF2 run as a wrong
// password: the response time must not say whether the email exists.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('merge-timing-pad'));

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';

	if (!email || !password) {
		throw error(400, 'Email and password are required to merge an account.');
	}

	// B3: this checks a password, so it is limited exactly as sign-in is, with the same counters
	// (ported from Pinfool c661c73): without that, anyone signed in could guess another account's
	// password here without limit and take the account (and its admin rights) by merging it.
	const kv = throttleStore(platform.env.DB);
	const ip = clientAddress(request);
	if (await isThrottled(kv, ip, email)) {
		throw error(429, 'Too many attempts. Try again in a few minutes.');
	}

	const sourceUser = await platform.env.DB.prepare(
		`SELECT u.id, u.email, u.name, u.github_login, u.github_avatar_url, u.is_admin, u.password_hash
		 FROM users u
		 LEFT JOIN user_login_aliases ula ON ula.user_id = u.id
		 WHERE lower(u.email) = lower(?) OR lower(ula.email) = lower(?)
		 LIMIT 1`
	)
		.bind(email, email)
		.first<MergeUserRecord>();

	if (!sourceUser?.password_hash) {
		await verifyPassword(password, await getDummyHash());
		await recordFailure(kv, ip, email);
		throw error(401, 'Invalid email or password.');
	}

	if (sourceUser.id === locals.user.id) {
		throw error(400, 'You are already signed in to that account.');
	}

	const isValidPassword = await verifyPassword(password, sourceUser.password_hash);
	if (!isValidPassword) {
		await recordFailure(kv, ip, email);
		throw error(401, 'Invalid email or password.');
	}

	await clearFailures(kv, ip, email);

	await mergeAccounts(platform.env.DB as any, sourceUser.id, locals.user.id);

	const authState = await getUserAuthState(
		platform.env.DB as any,
		locals.user.id,
		locals.user.email
	);

	return json({ success: true, message: 'Account merged successfully.', ...authState });
};
