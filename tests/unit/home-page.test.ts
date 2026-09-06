import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/+page.svelte';

// NOTE: These tests are skipped due to SvelteKit's page store issue in vitest.
// The page store cannot be subscribed to outside a Svelte component context.
// See: https://svelte.dev/docs/kit/state-management#avoid-shared-state-on-the-server
//
// They are kept in step with the markup anyway, so that whoever fixes the store
// problem inherits assertions that describe the hero as it is. The hero is
// deliberately plain: mark, name, tagline, member count, two links. The animated
// cosmic background and the decoy command-palette search box it used to carry
// are gone — the palette lives in the nav, behind its button and Cmd/Ctrl+K.
describe.skip('Home Page Hero', () => {
	it('should render the main title', () => {
		render(Page);
		expect(screen.getByRole('heading', { level: 1, name: '*Space' })).toBeTruthy();
	});

	it('should render the brand mark, decoratively', () => {
		const { container } = render(Page);
		const mark = container.querySelector('.hero-mark');
		expect(mark?.getAttribute('src')).toBe('/brand/starspace-mark.webp');
		// The h1 already says the name, so the image must not repeat it.
		expect(mark?.getAttribute('alt')).toBe('');
	});

	it('should render the tagline and the supporting copy', () => {
		render(Page);
		expect(screen.getByText(/Work, create and collaborate/i)).toBeTruthy();
		expect(screen.getByText(/inclusive digital coworking space on Discord/i)).toBeTruthy();
	});

	it('should offer exactly two ways on from the hero', () => {
		const { container } = render(Page);
		const actions = container.querySelectorAll('.hero-actions a');
		expect(actions.length).toBe(2);
		expect(actions[0].getAttribute('href')).toContain('discord');
		expect(actions[1].getAttribute('href')).toBe('/projects');
	});

	it('should not reinstate the decorative background or the decoy palette', () => {
		const { container } = render(Page);
		expect(container.querySelector('.cosmic-bg')).toBeNull();
		expect(container.querySelector('.command-palette')).toBeNull();
		expect(container.querySelector('.hero input')).toBeNull();
	});
});
