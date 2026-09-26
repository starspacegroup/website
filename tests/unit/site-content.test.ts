import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	communityProjects,
	featuredProjects,
	projects,
	starspaceProjects
} from '../../src/lib/data/projects';

const staticFile = (path: string) => join(process.cwd(), 'static', path.replace(/^\//, ''));

/** Every image these lists name has to be a file we actually ship. A rename in
 *  `static/` is otherwise invisible until someone loads the page and sees a
 *  broken card. */
const imagePaths = projects
	.flatMap((project) => [project.screenshot, project.screenshotLight, project.logo])
	.filter((path): path is string => typeof path === 'string');

describe('project directory', () => {
	it('lists projects', () => {
		expect(projects.length).toBeGreaterThan(0);
	});

	it('gives every project a unique id', () => {
		const ids = projects.map((project) => project.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('links every project over https', () => {
		for (const project of projects) {
			expect(project.url, project.id).toMatch(/^https:\/\//);
		}
	});

	// `external` decides target="_blank" and rel="noopener noreferrer" on the
	// card, so an off-site link that forgets it opens in place.
	it('marks off-site links external', () => {
		for (const project of projects) {
			expect(project.external, project.id).toBe(true);
		}
	});

	it('describes and tags every project', () => {
		for (const project of projects) {
			expect(project.name.length, project.id).toBeGreaterThan(0);
			expect(project.description.length, project.id).toBeGreaterThan(40);
			expect(project.tags.length, project.id).toBeGreaterThan(0);
		}
	});

	it('splits every project into *Space’s own or the community’s, and nothing else', () => {
		expect(starspaceProjects.length).toBeGreaterThan(0);
		expect(communityProjects.length).toBeGreaterThan(0);
		expect([...starspaceProjects, ...communityProjects].map((p) => p.id).sort()).toEqual(
			projects.map((p) => p.id).sort()
		);
	});

	// A community project is somebody's work outside *Space. The pill would say
	// the opposite of the section heading it sits under.
	it('never tags a community project "Made at *Space"', () => {
		for (const project of communityProjects) {
			expect(
				project.tags.some((tag) => tag.tone === 'made-here'),
				project.id
			).toBe(false);
		}
	});

	it('features only *Space’s own projects on the home page', () => {
		for (const project of featuredProjects) expect(project.maker, project.id).toBe('starspace');
	});

	it('features the head of the same list, so one edit moves both surfaces', () => {
		expect(featuredProjects).toEqual(projects.slice(0, featuredProjects.length));
		expect(featuredProjects.length).toBe(3);
	});
});

describe('card artwork', () => {
	it('names only files that ship in static/', () => {
		for (const path of imagePaths) {
			expect(path).toMatch(/^\//);
			expect(existsSync(staticFile(path)), `${path} is missing from static/`).toBe(true);
		}
	});

	// The dark capture is the one every card shows in dark mode and the fallback
	// in light mode, so a light capture on its own would leave dark mode blank.
	it('never gives a project a light capture without the dark one', () => {
		for (const project of projects) {
			if (project.screenshotLight) expect(project.screenshot, project.id).toBeTruthy();
		}
	});

	it('names light captures the way capture:projects writes them', () => {
		for (const project of projects) {
			if (!project.screenshotLight) continue;
			expect(project.screenshotLight).toBe(`/projects/${project.id}-screenshot-light.webp`);
		}
	});
});
