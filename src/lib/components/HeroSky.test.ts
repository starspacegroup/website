import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroSky from './HeroSky.svelte';

/**
 * The live field's pointer handling.
 *
 * happy-dom has no canvas, so the 2D context is a recorder: the first radial
 * gradient of each frame is the pool of light under the cursor, and its centre
 * is where the field thinks the pointer is. That is enough to tell whether a
 * move was heard without asserting on pixels.
 */
const W = 1000;
const H = 600;

let frames: FrameRequestCallback[] = [];
let pools: number[][] = [];

function fakeContext() {
	let firstInFrame = true;
	return {
		setTransform: vi.fn(),
		clearRect: () => {
			firstInFrame = true;
		},
		createRadialGradient: (...args: number[]) => {
			if (firstInFrame) pools.push(args);
			firstInFrame = false;
			return { addColorStop: vi.fn() };
		},
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: ''
	};
}

/** Run queued animation frames, which is where the eased pointer is drawn. */
function tick(count = 30) {
	for (let i = 0; i < count; i++) {
		const queued = frames;
		frames = [];
		for (const callback of queued) callback(performance.now());
	}
}

/** The hero as the home page builds it: the sky, and blocks stacked above it. */
function mountHero() {
	const hero = document.createElement('section');
	document.body.append(hero);
	render(HeroSky, { target: hero });
	const copy = document.createElement('h1');
	copy.textContent = '*Space';
	hero.append(copy);
	return { hero, copy };
}

const lastPoolX = () => pools[pools.length - 1][0];

beforeEach(() => {
	frames = [];
	pools = [];
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query === '(pointer: fine)',
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}));
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.push(callback);
		return frames.length;
	});
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(private callback: IntersectionObserverCallback) {}
			observe() {
				this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
			}
			disconnect() {}
		}
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => fakeContext() as never
	);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		top: 0,
		left: 0,
		width: W,
		height: H
	} as DOMRect);
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('HeroSky pointer', () => {
	it('starts with the pool of light in the middle', () => {
		mountHero();
		tick(1);
		expect(lastPoolX()).toBeCloseTo(W / 2);
	});

	it('follows a pointer that is over the hero’s own copy, not only the bare sky', () => {
		// The bug: the listener sat on the sky, which is underneath the copy,
		// buttons and voice panel. A cursor over any of them never reached it,
		// so the field froze exactly where people look.
		const { copy } = mountHero();
		copy.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: W * 0.9, clientY: H / 2 })
		);
		tick();
		expect(lastPoolX()).toBeGreaterThan(W * 0.7);
	});

	it('drifts back to the middle when the pointer leaves the hero', () => {
		const { hero, copy } = mountHero();
		copy.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: W * 0.9, clientY: H / 2 })
		);
		tick();
		hero.dispatchEvent(new PointerEvent('pointerleave'));
		tick(120);
		expect(lastPoolX()).toBeCloseTo(W / 2, 0);
	});
});
