import { describe, expect, it } from 'vitest';
import { CHANNEL_NOTES, channelNote } from './channel-notes';

describe('channelNote', () => {
	it('says what each voice room is for', () => {
		expect(channelNote('Ten Forward')).toMatch(/main room/);
		expect(channelNote('Engineering')).toMatch(/work room/);
		expect(channelNote('The Archive')).toMatch(/focus room/);
	});

	it('ignores emoji, case and spacing in the channel name', () => {
		expect(channelNote('🔇 The Archive')).toBe(channelNote('The Archive'));
		expect(channelNote('the-archive')).toBe(channelNote('The Archive'));
		expect(channelNote('TEN FORWARD')).toBe(channelNote('Ten Forward'));
	});

	it('says nothing about a room it does not know, and nothing for no name', () => {
		expect(channelNote('Sickbay')).toBeNull();
		expect(channelNote('🔇')).toBeNull();
		expect(channelNote('')).toBeNull();
	});

	it('takes a custom list', () => {
		expect(channelNote('Bridge', [{ name: 'Bridge', note: 'Command.' }])).toBe('Command.');
		expect(channelNote('Bridge', [])).toBeNull();
	});

	it('keeps every note a sentence or more, not a label', () => {
		for (const { note } of CHANNEL_NOTES) expect(note).toMatch(/\.\s*$/);
	});
});
