<script lang="ts">
	import type { ProjectTag } from '$lib/data/projects';

	export let tag: ProjectTag;
</script>

<span class="tag tag-{tag.tone}">{tag.label}</span>

<style>
	.tag {
		display: inline-block;
		padding: 0.15rem 0.55rem;
		border: 1px solid transparent;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	/* Built inside the community — the one tag worth the accent colour. */
	.tag-made-here {
		border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
		background: color-mix(in srgb, var(--color-primary) 14%, transparent);
		color: var(--color-primary);
	}

	/* What it is built with. Quiet: there are several per card. */
	.tag-stack {
		border-color: var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-secondary);
	}

	/* Where it came from — a hackathon, a jam. Rare, so it may shout. */
	.tag-event {
		border-color: color-mix(in srgb, var(--color-secondary) 45%, transparent);
		background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
		color: var(--color-secondary);
	}
</style>
