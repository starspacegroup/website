/**
 * What the voice channels are for, written down here because Discord gives a
 * voice channel no topic to say it.
 *
 * A text channel carries a topic its owners wrote, and the guide prints it. A
 * voice channel carries nothing, so until now its only description was the
 * measured line underneath — how many people, how long, when — which says how
 * a room is used but not what a newcomer should walk into it for. These notes
 * fill that gap.
 *
 * Matched by name, not id, for the same reason `FEATURED_ROLES` is: ids live
 * in Discord and have no business here. Matching ignores case, spacing and
 * anything that is not a letter or digit, because the server decorates channel
 * names with emoji (🔇 on the quiet room) and a note must not go missing
 * because someone added or removed one. Rename a channel outright and its note
 * drops off the page until this list is updated — visible, which beats a note
 * quietly attached to the wrong room.
 */

export type ChannelNote = {
	/** The channel's name as Discord shows it, emoji optional. */
	name: string;
	/** What the room is for, as a newcomer should hear it. */
	note: string;
};

export const CHANNEL_NOTES: readonly ChannelNote[] = [
	{
		name: 'Ten Forward',
		note: 'The main room, and the one most people are in. Come here to work with company, to talk, or to sit in on whatever is going on. If you only ever join one channel, join this one.'
	},
	{
		name: 'Engineering',
		note: 'The work room. Come here to build, fix, or pair on something alongside people doing the same. Quieter than Ten Forward on purpose, with its own chat for showing what you are working on.'
	},
	{
		name: 'The Archive',
		note: 'The focus room. Everyone is server-muted the moment they join, so nobody can talk here. Sit in it to work or study alongside other people with the sound off.'
	}
];

/** Letters and digits only, lower-cased: "🔇 The Archive" and "the archive" are the same room. */
const key = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '')
		.trim();

/** The note for a channel, or `null` when this site has nothing to say about it. */
export function channelNote(
	name: string,
	notes: readonly ChannelNote[] = CHANNEL_NOTES
): string | null {
	const wanted = key(name);
	if (!wanted) return null;
	return notes.find((entry) => key(entry.name) === wanted)?.note ?? null;
}
