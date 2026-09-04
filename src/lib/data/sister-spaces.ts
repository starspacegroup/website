/**
 * Sister spaces — the physical makerspaces *Space is allied with, shown at
 * `/sister-spaces`.
 *
 * Same reasoning as the project list: checked in, not CMS-backed. A sister
 * space is added roughly once a year and the page has to render on a clone with
 * no database behind it.
 */

import type { ProjectTag } from './projects';

export type SisterSpace = {
	/** Stable id — list key and test handle. */
	id: string;
	name: string;
	description: string;
	url: string;
	/** Street address, as the maps link renders it. */
	address: string;
	/** A maps deep link for the address above. */
	mapUrl: string;
	/** Path under `static/` for the space's photo. */
	image?: string;
	tags: ProjectTag[];
};

export const sisterSpaces: SisterSpace[] = [
	{
		id: 'arete-study',
		name: 'Arete.study',
		description:
			'A makerspace built for creators at every skill level. High-precision lathe, milling, CNC and laser machines, 3D printing, and a woodworking section with power tools. It also carries advanced electronics work — embedded systems and BGA/SMD soldering stations — plus carbon and fibreglass framing for the harder projects.',
		url: 'https://arete.study/',
		address: "Shevchenka St, 51, Tal'ne, Cherkasy Oblast, Ukraine, 20401",
		mapUrl: 'https://maps.app.goo.gl/1wRdfFEU3gHJMoZAA',
		image: '/sister-spaces/arete-study.webp',
		tags: [
			{ label: 'Make', tone: 'event' },
			{ label: 'Hack', tone: 'made-here' },
			{ label: 'Learn', tone: 'stack' }
		]
	}
];
