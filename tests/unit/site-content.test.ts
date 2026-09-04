import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { featuredProjects, projects } from '../../src/lib/data/projects';
import { sisterSpaces } from '../../src/lib/data/sister-spaces';

const staticFile = (path: string) => join(process.cwd(), 'static', path.replace(/^\//, ''));

/** Every image these lists name has to be a file we actually ship. A rename in
 *  `static/` is otherwise invisible until someone loads the page and sees a
 *  broken card. */
const imagePaths = [
	...projects.flatMap((project) => [project.screenshot, project.logo]),
	...sisterSpaces.map((space) => space.image)
].filter((path): path is string => typeof path === 'string');

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

	it('features the head of the same list, so one edit moves both surfaces', () => {
		expect(featuredProjects).toEqual(projects.slice(0, featuredProjects.length));
		expect(featuredProjects.length).toBe(3);
	});
});

describe('sister spaces', () => {
	it('lists sister spaces with unique ids', () => {
		expect(sisterSpaces.length).toBeGreaterThan(0);
		const ids = sisterSpaces.map((space) => space.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('carries a site link, an address and a map link for each', () => {
		for (const space of sisterSpaces) {
			expect(space.url, space.id).toMatch(/^https:\/\//);
			expect(space.mapUrl, space.id).toMatch(/^https:\/\//);
			expect(space.address.length, space.id).toBeGreaterThan(0);
		}
	});
});

describe('card artwork', () => {
	it('names only files that ship in static/', () => {
		for (const path of imagePaths) {
			expect(path).toMatch(/^\//);
			expect(existsSync(staticFile(path)), `${path} is missing from static/`).toBe(true);
		}
	});
});
