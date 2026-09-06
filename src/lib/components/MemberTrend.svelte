<script lang="ts">
	import type { MemberPoint } from '$lib/server/member-history';
	import { formatDayLabel } from '$lib/utils/stats-timeseries';
	import { onMount } from 'svelte';

	/**
	 * The last month of member counts as a sparkline under the hero's number —
	 * a trend beside a hero figure, in the stat-tile sense, not a chart with
	 * axes. One series, so no legend; the label above it says what it is.
	 *
	 * Marks follow the house chart rules: a 2px line with round joins, an area
	 * wash of the same hue at 10%, an end marker with a 2px ring in the surface
	 * colour, and text in text tokens — never in the series colour. A crosshair
	 * finds the nearest day on hover and on arrow keys, and a visually hidden
	 * table carries the same numbers for anyone who cannot use either.
	 *
	 * It renders nothing until it has two days to draw, and nothing at all when
	 * SpaceBot is not configured — the hero then looks exactly as it did before
	 * the graph existed.
	 */

	let points: MemberPoint[] = [];

	onMount(async () => {
		try {
			const response = await fetch('/api/members/history');
			if (!response.ok) return;
			const data = (await response.json()) as { points?: MemberPoint[] };
			points = Array.isArray(data.points) ? data.points : [];
		} catch {
			// No trend line. The count above still stands on its own.
		}
	});

	// Geometry is rebuilt at the rendered width so nothing is stretched.
	let measuredWidth = 0;
	$: width = Math.round(measuredWidth) || 320;
	const height = 56;
	const pad = { top: 6, right: 8, bottom: 6, left: 2 };

	$: n = points.length;
	$: min = n ? Math.min(...points.map((p) => p.members)) : 0;
	$: max = n ? Math.max(...points.map((p) => p.members)) : 0;
	// A flat month still gets a visible line: pad the range so it is not a
	// division by zero and the line sits mid-plot rather than on the floor.
	$: span = max - min || Math.max(1, Math.round(max * 0.02));
	$: floor = max - min ? min : min - span / 2;
	$: x = (i: number) => pad.left + (n > 1 ? (i / (n - 1)) * (width - pad.left - pad.right) : 0);
	$: y = (v: number) => pad.top + (1 - (v - floor) / span) * (height - pad.top - pad.bottom);
	$: linePath = points
		.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.members).toFixed(1)}`)
		.join(' ');
	$: areaPath = n
		? `${linePath} L${x(n - 1).toFixed(1)},${height - pad.bottom} L${x(0).toFixed(1)},${height - pad.bottom} Z`
		: '';

	$: first = points[0];
	$: last = points[n - 1];
	$: delta = first && last ? last.members - first.members : 0;

	const format = (value: number) => value.toLocaleString('en-US');
	const signed = (value: number) => (value > 0 ? `+${format(value)}` : format(value));

	// Hover and keyboard both drive the same index; the crosshair snaps to the
	// nearest day so the reader aims at a date, not at a 2px line.
	let hovered = -1;
	$: current = hovered >= 0 && hovered < n ? points[hovered] : null;
	$: tooltipLeft = current ? (x(hovered) / width) * 100 : 0;

	// To assistive technology the crosshair is a slider over the days: arrow
	// keys move it, and aria-valuetext reads the day and its count. That is
	// what the interaction is, and it is the one role that honestly permits
	// pointer and keyboard handlers on the plot.
	$: valueIndex = hovered >= 0 ? hovered : n - 1;
	$: valueText = points[valueIndex]
		? `${format(points[valueIndex].members)} members on ${formatDayLabel(points[valueIndex].day)}`
		: '';

	function nearest(clientX: number, target: HTMLElement) {
		const rect = target.getBoundingClientRect();
		const px = ((clientX - rect.left) / rect.width) * width;
		let best = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (let i = 0; i < n; i++) {
			const distance = Math.abs(x(i) - px);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = i;
			}
		}
		return best;
	}

	function onPointer(event: PointerEvent) {
		hovered = nearest(event.clientX, event.currentTarget as HTMLElement);
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			const step = event.key === 'ArrowLeft' ? -1 : 1;
			hovered = Math.min(n - 1, Math.max(0, (hovered < 0 ? n - 1 : hovered) + step));
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			hovered = event.key === 'Home' ? 0 : n - 1;
		} else if (event.key === 'Escape') {
			hovered = -1;
		}
	}
</script>

{#if n >= 2}
	<figure class="trend" bind:clientWidth={measuredWidth}>
		<div
			class="trend-plot"
			role="slider"
			tabindex="0"
			aria-label="Members over the last {n} days, from {format(first.members)} to {format(
				last.members
			)}. Arrow keys read one day at a time."
			aria-valuemin="0"
			aria-valuemax={n - 1}
			aria-valuenow={valueIndex}
			aria-valuetext={valueText}
			aria-orientation="horizontal"
			on:pointermove={onPointer}
			on:pointerdown={onPointer}
			on:pointerleave={() => (hovered = -1)}
			on:focus={() => (hovered = n - 1)}
			on:blur={() => (hovered = -1)}
			on:keydown={onKey}
		>
			<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
				<path class="trend-area" d={areaPath} />
				<path class="trend-line" d={linePath} />
				{#if current}
					<line
						class="trend-crosshair"
						x1={x(hovered)}
						x2={x(hovered)}
						y1={pad.top}
						y2={height - pad.bottom}
					/>
					<circle class="trend-dot" cx={x(hovered)} cy={y(current.members)} r="4" />
				{:else}
					<circle class="trend-dot" cx={x(n - 1)} cy={y(last.members)} r="4" />
				{/if}
			</svg>
			{#if current}
				<div
					class="trend-tooltip"
					style="left: {tooltipLeft}%"
					class:trend-tooltip-flip={tooltipLeft > 70}
					role="status"
				>
					<strong>{format(current.members)}</strong>
					<span>members · {formatDayLabel(current.day)}</span>
				</div>
			{/if}
		</div>
		<!-- The same numbers, for anyone who cannot hover or see the line. -->
		<table class="sr-only">
			<caption>Members on Discord, by day</caption>
			<thead><tr><th scope="col">Day</th><th scope="col">Members</th></tr></thead>
			<tbody>
				{#each points as p (p.day)}
					<tr><td>{formatDayLabel(p.day)}</td><td>{format(p.members)}</td></tr>
				{/each}
			</tbody>
		</table>

		<figcaption class="trend-caption">
			<span class="trend-delta">{signed(delta)}</span> in the last {n} days
		</figcaption>
	</figure>
{/if}

<style>
	.trend {
		width: 100%;
		max-width: 22rem;
		margin: var(--spacing-sm) auto 0;
		/* Follows the count's alignment: centred on a phone, left beside the
		   voice panel — the hero sets both custom properties on .hero-count. */
		margin-inline: var(--member-trend-inline, auto);
		text-align: var(--member-count-align, center);
	}

	.trend-plot {
		position: relative;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		cursor: crosshair;
		touch-action: pan-y;
		border-radius: var(--radius-sm);
	}

	svg:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.trend-area {
		fill: var(--color-primary);
		fill-opacity: 0.1;
	}

	.trend-line {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.trend-crosshair {
		stroke: var(--color-border);
		stroke-width: 1;
	}

	/* The 2px ring in the surface colour keeps the marker legible on the line. */
	.trend-dot {
		fill: var(--color-primary);
		stroke: var(--color-background);
		stroke-width: 2;
	}

	.trend-tooltip {
		position: absolute;
		top: -0.25rem;
		transform: translate(-50%, -100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.75rem;
		line-height: 1.3;
		white-space: nowrap;
		pointer-events: none;
	}

	.trend-tooltip strong {
		font-size: 0.9rem;
	}

	.trend-tooltip span {
		color: var(--color-text-secondary);
	}

	.trend-tooltip-flip {
		transform: translate(-100%, -100%);
	}

	.trend-caption {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.trend-delta {
		font-weight: 600;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}
</style>
