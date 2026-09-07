/**
 * The member figures the site shows in local development.
 *
 * The count has always had a dev short-circuit: the invite endpoint is rate
 * limited per IP and a hot-reloading dev server would hammer it. The trend line
 * under it had none, so locally the number was fake and the graph beside it was
 * simply absent — which looks like a broken feature rather than an absent one.
 * Both now come from here, so they cannot disagree about how many members there
 * are.
 *
 * **The numbers are deliberately not plausible.** 69,420 is a joke, and it is
 * one on purpose: nobody should be able to mistake a screenshot of local dev
 * for the live community. Nothing in this file is reachable in production —
 * every caller guards on `dev` from `$app/environment`.
 */

/** Total members, in dev. Not a real number, and not meant to look like one. */
export const DEV_MEMBERS = 69_420;

/** Members online, in dev. */
export const DEV_ONLINE = 420;

/** One day of the dev series. Matches `MemberPoint` in `server/member-history`. */
export type DevMemberPoint = {
	day: string;
	members: number;
	/**
	 * Equal to `members`: the made-up server has no bots in it.
	 *
	 * Production prefers this figure over the total, so leaving the two the same
	 * keeps the dev number and the dev line agreeing — which is the whole reason
	 * both of them come out of this file.
	 */
	human: number | null;
	online: number | null;
};

/**
 * A month of made-up history ending at {@link DEV_MEMBERS}.
 *
 * Deterministic — no clock beyond the day, no randomness — so the line does not
 * jump on every hot reload while somebody is looking at the layout. The shape
 * is a decelerating climb with a fixed weekly wobble on top: a straight line
 * would not exercise the crosshair or the area fill, and a random walk would
 * redraw itself constantly.
 */
export function devMemberSeries(days = 30, endingAt: Date = new Date()): DevMemberPoint[] {
	const span = Math.max(2, Math.trunc(days));
	const start = Math.round(DEV_MEMBERS * 0.91);

	// Repeats every 7 points, so the line reads as weeks without a generator.
	// Wide enough to outrun the curve late on, where an ease-out barely climbs:
	// a member count that only ever rises is the one shape a real one never has.
	const wobble = [0, 96, -142, 58, -74, 168, -36];
	const peak = Math.max(...wobble);

	const points: DevMemberPoint[] = [];
	for (let i = 0; i < span; i++) {
		const t = i / (span - 1);
		// Ease-out: most of the growth early, flattening toward today, which is
		// what a community that is filling up actually looks like.
		const eased = 1 - (1 - t) ** 2;
		// The curve aims below the final figure by the wobble's peak, so the
		// highest point on the line is today rather than some Tuesday three weeks
		// ago sitting above the number in the headline.
		const members =
			i === span - 1
				? DEV_MEMBERS
				: Math.round(start + (DEV_MEMBERS - peak - start) * eased + wobble[i % wobble.length]);

		const date = new Date(endingAt);
		date.setUTCDate(date.getUTCDate() - (span - 1 - i));

		points.push({
			day: date.toISOString().slice(0, 10),
			members,
			human: members,
			online: Math.round(DEV_ONLINE * (0.82 + 0.3 * eased))
		});
	}

	return points;
}
