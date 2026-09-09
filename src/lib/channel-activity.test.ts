import { describe, expect, it } from 'vitest';
import {
	describeLobby,
	describeTextActivity,
	describeVoiceActivity,
	formatDuration,
	formatHour,
	formatWhen,
	isVoiceChannel,
	whenClause
} from './channel-activity';
import type { ChannelActivity } from '$lib/server/guild-directory';

/**
 * The sentences under each channel on the server guide.
 *
 * The rule these all serve: the page may print what SpaceBot measured, and
 * nothing else. A channel nobody records is not a quiet channel, an absent
 * figure is not a zero, and a count this site never received is not a sentence.
 */

const activity = (over: Partial<ChannelActivity> = {}): ChannelActivity => ({
	messages: 0,
	posters: 0,
	lastMessageAt: null,
	voiceSeconds: 0,
	voicePeople: 0,
	voiceSessions: 0,
	typicalStaySeconds: null,
	busiestHourUtc: null,
	lastVoiceAt: null,
	lobby: false,
	...over
});

const NOW = new Date('2026-09-09T15:00:00Z');

describe('isVoiceChannel', () => {
	it('counts the kinds where people talk out loud', () => {
		expect(isVoiceChannel('voice')).toBe(true);
		expect(isVoiceChannel('stage')).toBe(true);
		expect(isVoiceChannel('text')).toBe(false);
		expect(isVoiceChannel('forum')).toBe(false);
	});
});

describe('formatDuration', () => {
	it('says nothing about a span too short to be worth a sentence', () => {
		expect(formatDuration(null)).toBeNull();
		expect(formatDuration(30)).toBeNull();
	});

	it('reads in minutes below an hour', () => {
		expect(formatDuration(1495)).toBe('25 minutes');
		expect(formatDuration(60)).toBe('1 minute');
	});

	it('keeps half an hour from rounding away in the working range', () => {
		expect(formatDuration(5400)).toBe('1.5 hours');
		expect(formatDuration(3600)).toBe('1 hour');
		expect(formatDuration(17936)).toBe('5 hours');
	});

	it('drops the fraction once it stops meaning anything', () => {
		expect(formatDuration(360_000)).toBe('100 hours');
	});
});

describe('formatHour', () => {
	it('reads the hour where the server lives', () => {
		expect(formatHour(0, 'America/New_York')).toBe('7 PM');
	});

	it('labels the zone when the server has not named one', () => {
		expect(formatHour(20, null)).toContain('8 PM');
		expect(formatHour(20, null)).toContain('UTC');
	});

	it('falls back rather than failing on a timezone it cannot use', () => {
		expect(formatHour(20, 'Mars/Olympus')).toContain('UTC');
	});

	it('refuses anything that is not an hour', () => {
		expect(formatHour(null, null)).toBeNull();
		expect(formatHour(24, null)).toBeNull();
		expect(formatHour(-1, null)).toBeNull();
	});
});

describe('formatWhen', () => {
	it('counts whole days, not elapsed hours', () => {
		// Late last night is "yesterday" this morning, which is what a reader means.
		expect(formatWhen('2026-09-08 23:40:00', NOW)).toBe('yesterday');
		expect(formatWhen('2026-09-09 02:00:00', NOW)).toBe('today');
	});

	it('names the day once "days ago" stops helping', () => {
		expect(formatWhen('2026-09-05 10:00:00', NOW)).toBe('4 days ago');
		expect(formatWhen('2026-09-01 10:00:00', NOW)).toBe('last week');
		expect(formatWhen('2026-08-12 10:00:00', NOW)).toBe('August 12');
	});

	it('adds the preposition a date needs and a relative phrase does not', () => {
		expect(whenClause('yesterday')).toBe('yesterday');
		expect(whenClause('4 days ago')).toBe('4 days ago');
		expect(whenClause('last week')).toBe('last week');
		expect(whenClause('August 12')).toBe('on August 12');
	});

	it('says nothing about a timestamp it cannot read', () => {
		expect(formatWhen(null, NOW)).toBeNull();
		expect(formatWhen('whenever', NOW)).toBeNull();
	});
});

describe('describeTextActivity', () => {
	it('says nothing when SpaceBot sent no counts', () => {
		expect(describeTextActivity(null, 30, NOW)).toBeNull();
		expect(describeTextActivity(activity(), null, NOW)).toBeNull();
	});

	it('reports what was said and when', () => {
		expect(
			describeTextActivity(
				activity({ messages: 91, posters: 7, lastMessageAt: '2026-09-08 18:04:00' }),
				30,
				NOW
			)
		).toBe('91 messages from 7 people in the last 30 days. Last one yesterday.');
	});

	it('counts one of a thing as one', () => {
		expect(describeTextActivity(activity({ messages: 1, posters: 1 }), 30, NOW)).toBe(
			'1 message from 1 person in the last 30 days.'
		);
	});

	it('calls an empty channel empty', () => {
		expect(describeTextActivity(activity(), 30, NOW)).toBe('Nothing posted in the last 30 days.');
	});

	it('never calls an unlogged channel quiet', () => {
		expect(describeTextActivity(activity({ messages: null, posters: null }), 30, NOW)).toBe(
			'Not counted — this channel is kept out of the logs.'
		);
	});
});

describe('describeVoiceActivity', () => {
	it('says nothing when SpaceBot sent no counts', () => {
		expect(describeVoiceActivity(null, 30, null, NOW)).toBeNull();
		expect(describeVoiceActivity(activity(), null, null, NOW)).toBeNull();
	});

	it('reports who was in, for how long, and when it fills up', () => {
		expect(
			describeVoiceActivity(
				activity({
					voiceSeconds: 17936,
					voicePeople: 3,
					voiceSessions: 12,
					typicalStaySeconds: 1495,
					busiestHourUtc: 0
				}),
				30,
				'America/New_York',
				NOW
			)
		).toBe(
			'3 people spent 5 hours here in the last 30 days, across 12 visits. ' +
				'A visit is usually about 25 minutes. Busiest around 7 PM.'
		);
	});

	it('drops the clauses it has no figure for', () => {
		expect(
			describeVoiceActivity(
				activity({ voiceSeconds: 7200, voicePeople: 1, voiceSessions: 1 }),
				30,
				null,
				NOW
			)
		).toBe('1 person spent 2 hours here in the last 30 days, across 1 visit.');
	});

	it('still reports visits when every one of them is still open', () => {
		// A session with nobody gone yet has no duration, so there is a head count
		// and no time. Saying "0 seconds" would be wrong about a full room.
		expect(
			describeVoiceActivity(
				activity({ voiceSeconds: 0, voicePeople: 2, voiceSessions: 2 }),
				30,
				null,
				NOW
			)
		).toBe('2 people dropped in during the last 30 days, across 2 visits.');
	});

	it('dates the silence when it can, and admits it when it cannot', () => {
		expect(
			describeVoiceActivity(activity({ lastVoiceAt: '2026-08-12 10:00:00' }), 30, null, NOW)
		).toBe('Quiet since August 12.');
		expect(describeVoiceActivity(activity(), 30, null, NOW)).toBe(
			'Nobody has been in here in the last 30 days.'
		);
	});
});

describe('describeLobby', () => {
	it('states the one voice channel whose purpose is a fact', () => {
		expect(describeLobby(activity({ lobby: true }))).toContain('room of your own');
	});

	it('says nothing about an ordinary channel', () => {
		expect(describeLobby(activity())).toBeNull();
		expect(describeLobby(null)).toBeNull();
	});
});
