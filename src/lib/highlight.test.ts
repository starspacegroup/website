import { describe, expect, it, vi } from 'vitest';
import hljs from 'highlight.js/lib/core';
import { SNIPPET_LANGUAGES, highlight, highlightSnippet } from './highlight';
import { badgeSnippets } from './badge';

/**
 * The output of this module is injected with `{@html}`, so the tests that
 * matter are the ones about what cannot come out of it: unescaped input, and a
 * blank panel where somebody's snippet used to be.
 */

const snippets = badgeSnippets({
	variant: 'building',
	theme: 'dark',
	origin: 'https://starspace.group'
});

describe('highlight', () => {
	it('marks up the parts of a tag', () => {
		const html = highlight('<a href="/x">hi</a>', 'xml');
		expect(html).toContain('hljs-tag');
		expect(html).toContain('hljs-attr');
	});

	it('escapes the source rather than emitting it', () => {
		// The angle brackets of the code being highlighted must come out as
		// entities, or the snippet renders as page markup instead of as code.
		const html = highlight('<script>alert(1)</script>', 'xml');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;');
	});

	it('escapes an unknown language instead of passing it through', () => {
		const html = highlight('<b>not code</b>', 'klingon');
		expect(html).toBe('&lt;b&gt;not code&lt;/b&gt;');
	});

	it('escapes every character that would break out', () => {
		expect(highlight('a & b "c" <d>', 'klingon')).toBe('a &amp; b &quot;c&quot; &lt;d&gt;');
	});

	it('gives back readable source when the grammar throws', () => {
		// A highlighter that fails must not take the snippet with it: the panel
		// still has to show the code, and the copy button next to it still has to
		// have something to copy.
		const spy = vi.spyOn(hljs, 'highlight').mockImplementation(() => {
			throw new Error('grammar exploded');
		});
		try {
			expect(highlight('<b>x</b>', 'xml')).toBe('&lt;b&gt;x&lt;/b&gt;');
		} finally {
			spy.mockRestore();
		}
	});

	it('leaves no bare closing bracket in the output', () => {
		// A `-->` that reaches the parser un-escaped opens and closes a comment
		// where the author meant text — the web component snippet starts with an
		// HTML comment, and under a highlighter that escaped only `<` it came out
		// rendered twice.
		const html = highlight('<!-- hi -->\n<b>x</b>', 'xml');
		expect(html).not.toMatch(/-->/);
		expect(html).toContain('--&gt;');
	});
});

describe('highlightSnippet', () => {
	it('has a language for every snippet the badge page emits', () => {
		// The page builds its list from `badgeSnippets`; a new form with no
		// language here would render as plain text and nobody would notice.
		for (const id of Object.keys(snippets)) {
			expect(SNIPPET_LANGUAGES).toHaveProperty(id);
		}
	});

	it('highlights each one without losing a character of it', () => {
		// The real guarantee: strip the markup back out and you have exactly the
		// snippet that went in. Colour is the only thing this module adds.
		const plain = (html: string) =>
			html
				.replace(/<[^>]+>/g, '')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#x27;/g, "'")
				.replace(/&amp;/g, '&');

		for (const [id, code] of Object.entries(snippets)) {
			const html = highlightSnippet(code, id);
			expect(html).toContain('hljs-');
			expect(plain(html)).toBe(code);
		}
	});

	it('falls back to escaped text for an id it does not know', () => {
		expect(highlightSnippet('<b>x</b>', 'cobol')).toBe('&lt;b&gt;x&lt;/b&gt;');
	});
});
