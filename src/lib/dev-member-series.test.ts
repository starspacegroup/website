import { describe, expect, it } from 'vitest';
import { DEV_MEMBERS, DEV_ONLINE, devMemberSeries } from './dev-member-series';

/**
 * The made-up month the hero draws in local development. What matters is that
 * it agrees with the count above it, that it does not move on its own, and that
 * nobody could mistake it for the real community.
 */

const AT = new Date('2026-09-07T12:00:00Z');

describe('dev member figures', () => {
	it('are deliberately not plausible', () => {
		expect(DEV_MEMBERS).toBe(69_420);
		expect(DEV_ONLINE).toBe(420);
	});
});

describe('devMemberSeries', () => {
	it('draws a month by default', () => {
		expect(devMemberSeries(undefined, AT)).toHaveLength(30);
	});

	it('ends on exactly the number the count shows', () => {
		// A graph that ends somewhere other than the figure above it is worse
		// than no graph.
		const series = devMemberSeries(30, AT);
		expect(series.at(-1)?.members).toBe(DEV_MEMBERS);
	});

	it('does not move between calls', () => {
		// It redraws on every hot reload; a line that jumps each time makes the
		// layout impossible to judge.
		expect(devMemberSeries(30, AT)).toEqual(devMemberSeries(30, AT));
	});

	it('ends today and runs backwards one day at a time', () => {
		const series = devMemberSeries(5, AT);
		expect(series.map((p) => p.day)).toEqual([
			'2026-09-03',
			'2026-09-04',
			'2026-09-05',
			'2026-09-06',
			'2026-09-07'
		]);
	});

	it('climbs overall, and wobbles rather than marching', () => {
		const series = devMemberSeries(30, AT);
		const members = series.map((p) => p.members);

		expect(members[0]).toBeLessThan(members.at(-1) as number);
		// A perfectly monotonic line exercises neither the crosshair nor the eye.
		const dips = members.filter((value, i) => i > 0 && value < members[i - 1]);
		expect(dips.length).toBeGreaterThan(0);
	});

	it('never rises above the figure in the headline', () => {
		// Today has to be the high point, or the line contradicts the number
		// printed above it.
		const series = devMemberSeries(30, AT);
		const members = series.map((p) => p.members);
		expect(Math.max(...members)).toBe(DEV_MEMBERS);

		for (const value of members) {
			expect(value).toBeGreaterThan(DEV_MEMBERS * 0.88);
			expect(Number.isInteger(value)).toBe(true);
		}
	});

	it('carries an online figure for every day', () => {
		for (const point of devMemberSeries(30, AT)) {
			expect(point.online).toBeGreaterThan(0);
			expect(point.online).toBeLessThan(DEV_MEMBERS);
		}
	});

	it('refuses to produce fewer than the two points a line needs', () => {
		expect(devMemberSeries(0, AT)).toHaveLength(2);
		expect(devMemberSeries(1, AT)).toHaveLength(2);
		expect(devMemberSeries(-5, AT)).toHaveLength(2);
	});

	it('truncates a fractional day count', () => {
		expect(devMemberSeries(7.9, AT)).toHaveLength(7);
	});

	it('honours a longer window', () => {
		const series = devMemberSeries(90, AT);
		expect(series).toHaveLength(90);
		expect(series.at(-1)?.members).toBe(DEV_MEMBERS);
		expect(series[0].day).toBe('2026-06-10');
	});
});
