import { describe, expect, it } from 'vitest';
import type { GuildDay, GuildRole } from '$lib/server/guild-stats';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	FEATURED_ROLES,
	TILE_SURFACE,
	describeWindow,
	featuredRoleCounts,
	formatAhead,
	formatCount,
	formatNetChange,
	formatStanding,
	ordinal,
	plural,
	recentDays,
	roleNameColor,
	sparklinePath,
	sparklinePoints,
	totalGuildDays
} from './stats-copy';

const day = (over: Partial<GuildDay> = {}): GuildDay => ({
	day: '2026-09-20',
	joins: 0,
	leaves: 0,
	netChange: 0,
	messages: 0,
	posters: 0,
	voiceSeconds: 0,
	voicePeople: 0,
	voicePeak: 0,
	...over
});

describe('formatCount', () => {
	it('separates thousands', () => {
		expect(formatCount(1234567)).toBe('1,234,567');
		expect(formatCount(0)).toBe('0');
	});

	it('prints nothing for a number it does not have', () => {
		expect(formatCount(null)).toBeNull();
		expect(formatCount(undefined)).toBeNull();
		expect(formatCount(Number.NaN)).toBeNull();
		expect(formatCount(Number.POSITIVE_INFINITY)).toBeNull();
	});
});

describe('ordinal', () => {
	it('handles the teens, which break the simple rule', () => {
		expect(ordinal(11)).toBe('11th');
		expect(ordinal(12)).toBe('12th');
		expect(ordinal(13)).toBe('13th');
		expect(ordinal(111)).toBe('111th');
	});

	it('handles the rest', () => {
		expect(ordinal(1)).toBe('1st');
		expect(ordinal(2)).toBe('2nd');
		expect(ordinal(3)).toBe('3rd');
		expect(ordinal(4)).toBe('4th');
		expect(ordinal(21)).toBe('21st');
		expect(ordinal(102)).toBe('102nd');
		expect(ordinal(1003)).toBe('1,003rd');
	});
});

describe('formatStanding', () => {
	it('always carries the field size', () => {
		// "4th" alone is meaningless: 4th of 6 and 4th of 600 are different lives.
		expect(formatStanding(4, 37)).toBe('4th of 37');
		expect(formatStanding(1, 1200)).toBe('1st of 1,200');
	});

	it('says so plainly when the field is one person', () => {
		expect(formatStanding(1, 1)).toBe('the only one');
	});

	it('prints nothing without a real rank', () => {
		expect(formatStanding(null, 37)).toBeNull();
		expect(formatStanding(0, 37)).toBeNull();
		expect(formatStanding(Number.NaN, 37)).toBeNull();
	});

	it('refuses a rank larger than the field it claims to be in', () => {
		expect(formatStanding(40, 37)).toBeNull();
		expect(formatStanding(4, Number.NaN)).toBeNull();
	});
});

describe('formatAhead', () => {
	it('counts the people behind them, not a percentile of the server', () => {
		expect(formatAhead(1, 10)).toBe('ahead of 90%');
		expect(formatAhead(5, 20)).toBe('ahead of 75%');
	});

	it('stays quiet in a field too small for a percentage to mean anything', () => {
		expect(formatAhead(1, 4)).toBeNull();
	});

	it('stays quiet for the person at the back, and for no rank at all', () => {
		expect(formatAhead(10, 10)).toBeNull();
		expect(formatAhead(null, 37)).toBeNull();
		expect(formatAhead(40, 37)).toBeNull();
	});
});

describe('plural', () => {
	it('does not read as a bug at one', () => {
		expect(plural(1, 'message')).toBe('1 message');
		expect(plural(2, 'message')).toBe('2 messages');
		expect(plural(0, 'message')).toBe('0 messages');
		expect(plural(1, 'person', 'people')).toBe('1 person');
		expect(plural(3, 'person', 'people')).toBe('3 people');
		expect(plural(1200, 'message')).toBe('1,200 messages');
	});
});

describe('sparklinePoints', () => {
	it('spans the width and scales against the peak, from a zero baseline', () => {
		const points = sparklinePoints([0, 5, 10]);
		expect(points.map((p) => p.x)).toEqual([0, 0.5, 1]);
		// From zero, not from the smallest value: a chart that starts at 400
		// makes a quiet week look like a collapse.
		expect(points.map((p) => p.y)).toEqual([0, 0.5, 1]);
	});

	it('draws nothing from one point, or none', () => {
		expect(sparklinePoints([])).toEqual([]);
		expect(sparklinePoints([7])).toEqual([]);
		expect(sparklinePoints([1, Number.NaN])).toEqual([]);
	});

	it('is a flat floor when nothing happened, not a division by zero', () => {
		expect(sparklinePoints([0, 0, 0]).map((p) => p.y)).toEqual([0, 0, 0]);
	});

	it('does not let a negative day dip below the floor', () => {
		expect(sparklinePoints([-4, 10]).map((p) => p.y)).toEqual([0, 1]);
	});
});

describe('sparklinePath', () => {
	it('is an SVG polyline with the origin at the top left', () => {
		expect(sparklinePath([0, 10], 100, 28)).toBe('0.00,28.00 100.00,0.00');
	});

	it('is null when there is no line to draw', () => {
		expect(sparklinePath([5], 100, 28)).toBeNull();
	});
});

describe('describeWindow', () => {
	it('counts the days it actually has', () => {
		// A server watched for eleven days must not be labelled "the last 90".
		expect(describeWindow([day(), day(), day()])).toBe('the last 3 days');
		expect(describeWindow([day()])).toBe('one day');
		expect(describeWindow([])).toBeNull();
	});
});

describe('formatNetChange', () => {
	it('signs the change', () => {
		expect(formatNetChange(12)).toBe('+12');
		expect(formatNetChange(-3)).toBe('−3');
		expect(formatNetChange(1500)).toBe('+1,500');
	});

	it('says nothing when nothing changed', () => {
		expect(formatNetChange(0)).toBeNull();
		expect(formatNetChange(Number.NaN)).toBeNull();
	});
});

describe('totalGuildDays', () => {
	it('adds the counts and takes the peaks', () => {
		const totals = totalGuildDays([
			day({ joins: 3, leaves: 1, netChange: 2, messages: 100, voiceSeconds: 600, voicePeak: 4 }),
			day({ joins: 1, leaves: 4, netChange: -3, messages: 250, voiceSeconds: 900, voicePeak: 2 })
		]);

		expect(totals).toEqual({
			days: 2,
			joins: 4,
			leaves: 5,
			netChange: -1,
			messages: 350,
			voiceSeconds: 1500,
			busiestDayMessages: 250,
			voicePeak: 4
		});
	});

	it('offers no window-wide unique count, because there is no honest one', () => {
		const totals = totalGuildDays([day({ posters: 9 }), day({ posters: 9 })]);
		// Summing distinct-per-day counts the same regular once per day they
		// showed up, so the totals deliberately carry no such field.
		expect(totals).not.toHaveProperty('posters');
		expect(totals).not.toHaveProperty('voicePeople');
	});

	it('is all zeroes over nothing', () => {
		expect(totalGuildDays([]).days).toBe(0);
		expect(totalGuildDays([]).messages).toBe(0);
	});
});

describe('recentDays', () => {
	const days = [day({ day: 'a' }), day({ day: 'b' }), day({ day: 'c' })];

	it('takes the most recent, keeping them oldest first', () => {
		expect(recentDays(days, 2).map((d) => d.day)).toEqual(['b', 'c']);
	});

	it('returns everything it has when asked for more', () => {
		expect(recentDays(days, 30)).toHaveLength(3);
	});

	it('returns nothing for a window of nothing', () => {
		expect(recentDays(days, 0)).toEqual([]);
		expect(recentDays(days, -1)).toEqual([]);
	});
});

describe('featuredRoleCounts', () => {
	const role = (
		id: string,
		name: string,
		members: number,
		color: string | null = null
	): GuildRole => ({
		id,
		name,
		members,
		color
	});
	const all = [
		role('9', 'Moderator', 6),
		role('5', 'Wearing Communicator Badge', 41),
		role('3', 'Passenger', 312, '#3498db'),
		role('1', 'Lurker', 900)
	];

	it('features Passenger and Wearing Communicator Badge, in that order', () => {
		expect(FEATURED_ROLES.map((r) => r.name)).toEqual(['Passenger', 'Wearing Communicator Badge']);
		expect(featuredRoleCounts(all).map((r) => [r.name, r.members])).toEqual([
			['Passenger', 312],
			['Wearing Communicator Badge', 41]
		]);
	});

	it('says what each featured role means, and nothing invented for a role without a description', () => {
		const [passenger, badge] = featuredRoleCounts(all);
		expect(passenger.description).toMatch(/joined voice chat/);
		expect(passenger.description).toMatch(/permissions above a basic member/);
		expect(badge.description).toMatch(
			/notified when someone in voice chat is trying to get more people/
		);
		const [lone] = featuredRoleCounts(all, [{ name: 'Moderator' }]);
		expect(lone.description).toBeNull();
	});

	it('keeps the colour SpaceBot sent', () => {
		expect(featuredRoleCounts(all)[0].color).toBe('#3498db');
	});

	it('shows no other role, whatever SpaceBot sends', () => {
		const names = featuredRoleCounts(all).map((r) => r.name);
		expect(names).not.toContain('Moderator');
		expect(names).not.toContain('Lurker');
	});

	it('matches names ignoring case and stray spaces, and keeps Discord’s spelling', () => {
		expect(featuredRoleCounts([role('3', ' passenger ', 312)]).map((r) => r.name)).toEqual([
			' passenger '
		]);
	});

	it('leaves out a featured role SpaceBot did not report, rather than printing zero', () => {
		// Renamed or deleted in Discord: the page does not know how many hold it.
		expect(featuredRoleCounts([role('3', 'Passenger', 312)]).map((r) => r.name)).toEqual([
			'Passenger'
		]);
	});

	it('takes the higher of two roles that share a name', () => {
		const shown = featuredRoleCounts([role('8', 'Passenger', 10), role('2', 'Passenger', 99)]);
		expect(shown.map((r) => r.id)).toEqual(['8']);
	});

	it('shows nothing when SpaceBot had no counts', () => {
		expect(featuredRoleCounts(null)).toEqual([]);
		expect(featuredRoleCounts(undefined)).toEqual([]);
	});
});

describe('roleNameColor', () => {
	it('uses the role’s colour for its name where it reads on the tile', () => {
		// A mid blue: fine on the dark tile, fine on the light one.
		expect(roleNameColor('#1d6fd0', 'light')).toBe('#1d6fd0');
		expect(roleNameColor('#5dade2', 'dark')).toBe('#5dade2');
	});

	it('falls back to the page colour where the role colour would not read', () => {
		// Discord colours are picked for its dark client; a pale one vanishes on
		// the light theme, and a very dark one on the dark theme.
		expect(roleNameColor('#f1c40f', 'light')).toBeNull();
		expect(roleNameColor('#1f1f5f', 'dark')).toBeNull();
	});

	it('has nothing to say about a role with no colour', () => {
		expect(roleNameColor(null, 'light')).toBeNull();
		expect(roleNameColor(null, 'dark')).toBeNull();
	});

	it('checks against the tile ground app.css actually paints', () => {
		// TILE_SURFACE restates --color-surface; this is what keeps it honest.
		const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');
		const surfaces = [...css.matchAll(/--color-surface:\s*(#[0-9a-fA-F]{6})/g)].map((m) =>
			m[1].toLowerCase()
		);
		expect(surfaces[0]).toBe(TILE_SURFACE.light);
		expect(surfaces[1]).toBe(TILE_SURFACE.dark);
	});
});
