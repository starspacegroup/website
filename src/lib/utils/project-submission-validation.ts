/**
 * Validation for a project submission from `/projects`.
 *
 * Pure and dependency-free, so the page action and its tests share one rule
 * set. Lengths are set by the card the entry would become: a name that fits on
 * one line, a description the size of the ones already on the page.
 */

export interface ProjectSubmissionInput {
	name: string;
	url: string;
	description: string;
	/** Anything the reviewer should know that does not belong on the card. */
	notes: string | null;
}

export type ProjectSubmissionValidationResult =
	{ ok: true; value: ProjectSubmissionInput } | { ok: false; error: string };

export const PROJECT_NAME_MAX_LENGTH = 60;
export const PROJECT_DESCRIPTION_MIN_LENGTH = 20;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 400;
export const PROJECT_NOTES_MAX_LENGTH = 1000;
export const PROJECT_URL_MAX_LENGTH = 500;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * A link a visitor can click from a public page: absolute, http(s), with a
 * host that has a dot in it. Nothing else is a project URL.
 */
export function isPublicHttpUrl(value: string): boolean {
	if (value.length > PROJECT_URL_MAX_LENGTH) return false;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
	if (url.username || url.password) return false;
	const host = url.hostname.toLowerCase();
	if (!host.includes('.') || host === 'localhost' || host.endsWith('.local')) return false;
	return true;
}

export function validateProjectSubmission(raw: {
	name?: unknown;
	url?: unknown;
	description?: unknown;
	notes?: unknown;
}): ProjectSubmissionValidationResult {
	const name = text(raw.name);
	const url = text(raw.url);
	const description = text(raw.description);
	const notes = text(raw.notes);

	if (!name || !url || !description) {
		return { ok: false, error: 'A name, a link and a description are all needed.' };
	}
	if (name.length > PROJECT_NAME_MAX_LENGTH) {
		return { ok: false, error: `Keep the name under ${PROJECT_NAME_MAX_LENGTH} characters.` };
	}
	if (!isPublicHttpUrl(url)) {
		return { ok: false, error: 'The link has to be a full web address, starting with https://.' };
	}
	if (description.length < PROJECT_DESCRIPTION_MIN_LENGTH) {
		return {
			ok: false,
			error: `Say a little more — at least ${PROJECT_DESCRIPTION_MIN_LENGTH} characters.`
		};
	}
	if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
		return {
			ok: false,
			error: `Keep the description under ${PROJECT_DESCRIPTION_MAX_LENGTH} characters.`
		};
	}
	if (notes.length > PROJECT_NOTES_MAX_LENGTH) {
		return { ok: false, error: `Keep the notes under ${PROJECT_NOTES_MAX_LENGTH} characters.` };
	}

	return { ok: true, value: { name, url, description, notes: notes || null } };
}
