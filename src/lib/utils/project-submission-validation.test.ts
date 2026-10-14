import { describe, expect, it } from 'vitest';
import {
	PROJECT_DESCRIPTION_MAX_LENGTH,
	PROJECT_NAME_MAX_LENGTH,
	PROJECT_NOTES_MAX_LENGTH,
	PROJECT_URL_MAX_LENGTH,
	isPublicHttpUrl,
	validateProjectSubmission
} from './project-submission-validation';

const good = {
	name: 'Sortalizer',
	url: 'https://sortalizer.example.com/',
	description: 'Sorts the things you cannot be bothered to sort, in the browser, for free.'
};

describe('isPublicHttpUrl', () => {
	it('accepts an ordinary https link', () => {
		expect(isPublicHttpUrl('https://example.com/thing')).toBe(true);
		expect(isPublicHttpUrl('http://example.com')).toBe(true);
	});

	it.each([
		['javascript:alert(1)', 'a script scheme'],
		['ftp://example.com', 'another scheme'],
		['example.com', 'no scheme'],
		['https://localhost:4203', 'localhost'],
		['https://box.local', 'a .local host'],
		['https://intranet', 'a host with no dot'],
		['https://user:pw@example.com', 'embedded credentials'],
		['not a url at all', 'junk'],
		[`https://example.com/${'a'.repeat(PROJECT_URL_MAX_LENGTH)}`, 'too long']
	])('rejects %s (%s)', (url) => {
		expect(isPublicHttpUrl(url)).toBe(false);
	});
});

describe('validateProjectSubmission', () => {
	it('trims and accepts a complete submission, with notes absent', () => {
		const result = validateProjectSubmission({
			name: `  ${good.name} `,
			url: ` ${good.url}`,
			description: `${good.description}  `,
			notes: '   '
		});
		expect(result).toEqual({ ok: true, value: { ...good, notes: null } });
	});

	it('keeps notes when there are some', () => {
		const result = validateProjectSubmission({ ...good, notes: ' please be kind ' });
		expect(result.ok && result.value.notes).toBe('please be kind');
	});

	it('refuses a missing field, whatever type it arrives as', () => {
		expect(validateProjectSubmission({ ...good, name: '' }).ok).toBe(false);
		expect(validateProjectSubmission({ ...good, url: undefined }).ok).toBe(false);
		expect(validateProjectSubmission({ ...good, description: 42 }).ok).toBe(false);
	});

	it('refuses a name past the card width', () => {
		const result = validateProjectSubmission({
			...good,
			name: 'x'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
		});
		expect(result).toMatchObject({ ok: false, error: expect.stringContaining('name') });
	});

	it('refuses a link that is not a public web address', () => {
		const result = validateProjectSubmission({ ...good, url: 'javascript:alert(1)' });
		expect(result).toMatchObject({ ok: false, error: expect.stringContaining('https://') });
	});

	it('refuses a description that is too short or too long', () => {
		expect(validateProjectSubmission({ ...good, description: 'tiny' })).toMatchObject({
			ok: false,
			error: expect.stringContaining('more')
		});
		expect(
			validateProjectSubmission({
				...good,
				description: 'x'.repeat(PROJECT_DESCRIPTION_MAX_LENGTH + 1)
			})
		).toMatchObject({ ok: false, error: expect.stringContaining('description') });
	});

	it('refuses notes long enough to be a second essay', () => {
		const result = validateProjectSubmission({
			...good,
			notes: 'x'.repeat(PROJECT_NOTES_MAX_LENGTH + 1)
		});
		expect(result).toMatchObject({ ok: false, error: expect.stringContaining('notes') });
	});
});
