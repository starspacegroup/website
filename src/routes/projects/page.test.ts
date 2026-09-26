import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { communityProjects, starspaceProjects } from '$lib/data/projects';

/** The two sections are two claims — ours, and our people's — so each card has to be under the right one. */
const section = (heading: string) =>
	screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;

const titles = (el: HTMLElement) =>
	within(el)
		.getAllByRole('heading', { level: 3 })
		.map((h) => h.textContent?.trim());

describe('projects page', () => {
	it('lists *Space’s own projects under "Built by *Space"', () => {
		render(Page);
		expect(titles(section('Built by *Space'))).toEqual(starspaceProjects.map((p) => p.name));
	});

	it('lists community members’ projects under "From the community"', () => {
		render(Page);
		expect(titles(section('From the community'))).toEqual(communityProjects.map((p) => p.name));
	});

	it('no longer lists Reddisco', () => {
		render(Page);
		expect(screen.queryByText(/Reddisco/i)).toBeNull();
	});
});
