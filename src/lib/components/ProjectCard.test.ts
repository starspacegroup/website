import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ProjectCard from './ProjectCard.svelte';
import type { Project } from '$lib/data/projects';

const project = (over: Partial<Project> = {}): Project => ({
	id: 'demo',
	name: 'Demo',
	description: 'A project that exists for this test and nowhere else, long enough to count.',
	url: 'https://demo.example/',
	external: true,
	maker: 'starspace',
	screenshot: '/projects/demo-screenshot.webp',
	tags: [{ label: 'Made at *Space', tone: 'made-here' }],
	...over
});

const art = (container: HTMLElement) =>
	[...container.querySelectorAll('.card-art img')] as HTMLImageElement[];

describe('ProjectCard artwork', () => {
	it('shows the one capture, unmarked, when there is no light version', () => {
		const { container } = render(ProjectCard, { props: { project: project() } });
		const images = art(container);
		expect(images).toHaveLength(1);
		expect(images[0].getAttribute('src')).toBe('/projects/demo-screenshot.webp');
		// Unmarked, so neither theme rule hides it: a dark-only site shows its
		// dark capture in light mode too, which is what that site looks like.
		expect(images[0].className).not.toMatch(/shot-/);
	});

	it('carries both captures when the site has a light look, one per theme', () => {
		const { container } = render(ProjectCard, {
			props: { project: project({ screenshotLight: '/projects/demo-screenshot-light.webp' }) }
		});
		const images = art(container);
		expect(images).toHaveLength(2);

		const dark = images.find((img) => img.classList.contains('shot-dark'));
		const light = images.find((img) => img.classList.contains('shot-light'));
		expect(dark?.getAttribute('src')).toBe('/projects/demo-screenshot.webp');
		expect(light?.getAttribute('src')).toBe('/projects/demo-screenshot-light.webp');
	});

	it('loads both eagerly on the first cards and lazily below the fold', () => {
		const withLight = project({ screenshotLight: '/projects/demo-screenshot-light.webp' });
		const eager = render(ProjectCard, { props: { project: withLight, eager: true } });
		expect(art(eager.container).every((img) => img.loading === 'eager')).toBe(true);
		eager.unmount();

		const lazy = render(ProjectCard, { props: { project: withLight } });
		expect(art(lazy.container).every((img) => img.loading === 'lazy')).toBe(true);
	});
});
