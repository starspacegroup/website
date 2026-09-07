import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import type { PageServerLoad } from './$types';

/**
 * The sign-in page, which also has to answer "you are already signed in".
 *
 * It used to redirect an authenticated visitor to the home page without saying
 * anything. Clicking *Sign in* and landing on the home page is indistinguishable
 * from a sign-in that failed, and it was reported as exactly that — a login that
 * "just redirects to home" — by someone whose session was valid the whole time.
 *
 * So it renders instead. Being already signed in is a normal thing to tell
 * somebody, not a reason to move them somewhere else.
 */
export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (locals.user) {
		const user = locals.user;
		return {
			signedInAs: {
				name: user.githubLogin || user.name || user.email,
				// Drives the link to the admin area: offering it to someone who
				// would only be bounced back is worse than not offering it.
				canOpenAdmin: Boolean(user.isOwner || user.isAdmin || user.isSuperAdmin),
				// They were sent here from a page they could not open. Say so —
				// signing in again is not the fix, and would look like one.
				lacksAccess: url.searchParams.get('error') === 'unauthorized'
			},
			configuredProviders: { github: false, discord: false },
			simulatedProviders: { github: false, discord: false },
			devAuthSimulationEnabled: false
		};
	}

	const configuredProviders = await getConfiguredAuthProviders(platform);
	const devAuthSimulationEnabled = isDevAuthSimulationEnabled(url, platform);
	const simulatedProviders = {
		github: devAuthSimulationEnabled && !configuredProviders.github,
		discord: devAuthSimulationEnabled && !configuredProviders.discord
	};

	return {
		signedInAs: null,
		configuredProviders,
		simulatedProviders,
		devAuthSimulationEnabled
	};
};
