<script lang="ts">
	import VoiceChannelDemo from '$lib/components/VoiceChannelDemo.svelte';
	import VoiceChannelLive from '$lib/components/VoiceChannelLive.svelte';
	import type { VoiceSnapshot } from '$lib/server/voice-channel';
	import { onDestroy, onMount } from 'svelte';

	/**
	 * The hero's voice panel: the real #Ten Forward when three or more people are
	 * in it, and the simulation the rest of the time.
	 *
	 * The threshold lives on the server — `/api/voice` answers `{live:false}` and
	 * no names below it — so this component only has to decide which panel to
	 * draw. Every failure path lands on the simulation, which is why there is no
	 * error state: a hero that says "could not reach the bot" helps nobody.
	 */

	/** How often to ask, while the tab is visible. */
	export let intervalMs = 15000;

	let snapshot: VoiceSnapshot = { live: false };
	let timer: ReturnType<typeof setInterval> | undefined;

	async function poll() {
		try {
			const response = await fetch('/api/voice');
			if (!response.ok) return;
			snapshot = (await response.json()) as VoiceSnapshot;
		} catch {
			// Keep whatever is on screen. A dropped poll is not news.
		}
	}

	function start() {
		stop();
		void poll();
		timer = setInterval(poll, intervalMs);
	}

	function stop() {
		if (timer) clearInterval(timer);
		timer = undefined;
	}

	/**
	 * A backgrounded tab does not need to know who is in voice, and polling from
	 * dozens of forgotten tabs is exactly the load the KV cache exists to avoid.
	 * Stop on hide, and poll immediately on return so the panel is right by the
	 * time it is looked at.
	 */
	function onVisibilityChange() {
		if (document.visibilityState === 'visible') start();
		else stop();
	}

	onMount(() => {
		start();
		document.addEventListener('visibilitychange', onVisibilityChange);
	});

	onDestroy(() => {
		stop();
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		}
	});
</script>

{#if snapshot.live}
	<VoiceChannelLive members={snapshot.members} channel={snapshot.channel} />
{:else}
	<VoiceChannelDemo />
{/if}
