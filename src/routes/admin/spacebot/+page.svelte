<script lang="ts">
	import { dev } from '$app/environment';
	import type { SpaceBotStatus } from '$lib/server/spacebot-connection';
	import type { PageData } from './$types';

	export let data: PageData;

	let status: SpaceBotStatus = data.status;
	let apiUrl = status.apiUrl ?? 'https://spacebot.starspace.group';
	let apiKey = '';
	let channel = status.channel;
	let busy = false;
	let message = '';
	let failed = false;

	/** One request drives all three buttons; only the method differs. */
	async function send(method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
		busy = true;
		message = '';
		failed = false;
		try {
			const response = await fetch('/api/admin/spacebot', {
				method,
				headers: body ? { 'content-type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			const payload = (await response.json().catch(() => ({}))) as {
				status?: SpaceBotStatus;
				message?: string;
			};

			if (!response.ok) {
				failed = true;
				message = payload.message || 'That did not work.';
				return;
			}

			if (payload.status) status = payload.status;
			apiUrl = status.apiUrl ?? apiUrl;
			channel = status.channel;
			if (method === 'POST') {
				// Never keep the key in a field after it is stored.
				apiKey = '';
				message = 'Connected.';
			}
			if (method === 'DELETE') message = 'Disconnected.';
		} catch {
			failed = true;
			message = 'Could not reach this site’s own API.';
		} finally {
			busy = false;
		}
	}

	const SCOPE_COPY: Record<string, string> = {
		ok: 'working',
		unauthorized: 'the key was rejected',
		forbidden: 'the key is missing this scope',
		error: 'SpaceBot answered with an error',
		unreachable: 'SpaceBot could not be reached',
		unconfigured: 'not connected'
	};

	$: connected = status.connected;
</script>

<svelte:head><title>SpaceBot — Admin</title></svelte:head>

<div class="page">
	<header class="head">
		<h1>SpaceBot</h1>
		<p class="lede">
			The Discord bot behind the home page's live voice panel and its member-count graph. One key
			powers both.
		</p>
	</header>

	<section class="card" aria-labelledby="status-heading">
		<div class="card-head">
			<h2 id="status-heading">Connection</h2>
			<span class="pill" class:pill-on={connected} class:pill-off={!connected}>
				{connected ? 'Connected' : 'Not connected'}
			</span>
		</div>

		{#if status.source !== 'none'}
			<dl class="facts">
				<div>
					<dt>Address</dt>
					<dd class="mono">{status.apiUrl}</dd>
				</div>
				<div>
					<dt>Key</dt>
					<dd class="mono">{status.keyHint}</dd>
				</div>
				<div>
					<dt>Channel</dt>
					<dd>#{status.channel}</dd>
				</div>
				<div>
					<dt>Set from</dt>
					<dd>{status.source === 'kv' ? 'this page' : 'environment variables'}</dd>
				</div>
				{#if status.connectedAt}
					<div>
						<dt>Connected on</dt>
						<dd>{new Date(status.connectedAt).toLocaleString()}</dd>
					</div>
				{/if}
			</dl>

			<ul class="scopes">
				<li class:scope-ok={status.voice === 'ok'}>
					<code>voice:read</code>
					<span>{SCOPE_COPY[status.voice]}</span>
					<em>
						{#if status.voice === 'ok'}
							Live panel on. {status.inVoice ?? 0} in voice right now.
						{:else}
							The hero shows its simulated channel.
						{/if}
					</em>
				</li>
				<li class:scope-ok={status.stats === 'ok'}>
					<code>stats:read</code>
					<span>{SCOPE_COPY[status.stats]}</span>
					<em>
						{#if status.stats === 'ok'}
							Member graph on. {status.historyDays ?? 0} day{status.historyDays === 1 ? '' : 's'} of history.
						{:else}
							The member count shows without its trend line.
						{/if}
					</em>
				</li>
				<li class:scope-ok={status.channels === 'ok'}>
					<code>channels:read</code>
					<span>{SCOPE_COPY[status.channels]}</span>
					<em>
						{#if status.channels === 'ok'}
							Channel list on. {status.channelCount ?? 0} public channel{status.channelCount === 1
								? ''
								: 's'}.
						{:else}
							<a href="/guide">The server guide</a> cannot list the channels.
						{/if}
					</em>
				</li>
				<li class:scope-ok={status.commands === 'ok'}>
					<code>commands:read</code>
					<span>{SCOPE_COPY[status.commands]}</span>
					<em>
						{#if status.commands === 'ok'}
							Command list on. {status.commandCount ?? 0} command{status.commandCount === 1
								? ''
								: 's'}.
						{:else}
							<a href="/guide">The server guide</a> cannot list the commands.
						{/if}
					</em>
				</li>
			</ul>
		{:else}
			<p class="empty">
				Nothing is connected. The hero runs its simulated voice channel and shows the member count
				without a trend line — which is a perfectly fine way to leave it.
			</p>
		{/if}

		<div class="actions">
			<button class="btn" on:click={() => send('GET')} disabled={busy}>
				{busy ? 'Checking…' : 'Test connection'}
			</button>
			{#if status.source === 'kv'}
				<button class="btn btn-danger" on:click={() => send('DELETE')} disabled={busy}>
					Disconnect
				</button>
			{/if}
		</div>

		{#if message}
			<p class="message" class:message-bad={failed} role="status">{message}</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="connect-heading">
		<h2 id="connect-heading">{status.source === 'kv' ? 'Replace the key' : 'Connect'}</h2>

		{#if data.outcome}
			<p class="outcome" class:failed={data.outcome.failed}>{data.outcome.message}</p>
		{/if}

		{#if data.connectAvailable}
			<div class="one-click">
				<a class="btn btn-primary" href="/admin/spacebot/connect" data-sveltekit-reload>
					Connect with SpaceBot
				</a>
				<p class="note">
					Opens SpaceBot, where you pick the server and approve all four read-only scopes. The key
					comes back between the two servers — it never passes through this browser.
				</p>
				<!-- Both halves of the handshake are exact-match settings on the
				     registration, and getting either wrong ends on the same refusal
				     screen at SpaceBot with nothing here to say which one it was. -->
				<dl class="connect-facts">
					<div>
						<dt>Goes to</dt>
						<dd><code>{data.connectSpaceBotUrl}</code></dd>
					</div>
					<div>
						<dt>Comes back to</dt>
						<dd><code>{data.connectReturnUrl}</code></dd>
					</div>
				</dl>
				<p class="note">
					Both must be registered with that SpaceBot, character for character. The return address
					follows whatever address you are reading this page on — open the site on its real address,
					not through a tunnel, or the return address will not be one that is registered.
				</p>
			</div>
		{:else}
			<!-- The button used to just not be there. That is right — one that cannot
			     work is worse than none — but a silent absence sends whoever expected
			     it hunting through the code for a bug that is really an unset
			     variable, which is exactly what happened. Say so instead. -->
			<p class="unavailable">
				<strong>One-click connect is not set up for this site.</strong> It needs
				<code>SPACEBOT_CONNECT_URL</code>, <code>SPACEBOT_CONNECT_CLIENT_ID</code> and
				<code>SPACEBOT_CONNECT_CLIENT_SECRET</code>, which come from registering this site with a
				SpaceBot instance. Paste a key by hand below in the meantime.
			</p>
			{#if dev}
				<p class="note">
					In local dev these are read from <code>.dev.vars</code> once, when the server starts. If
					you added them since, restart <code>bun run dev</code> — the values are cached for the life
					of the process.
				</p>
			{/if}
		{/if}

		<!-- Balanced markup rather than an {#if} wrapping a half-open <details>:
		     when one-click is unavailable this is simply open by default. -->
		<details class="manual" open={!data.connectAvailable}>
			<summary>{data.connectAvailable ? 'Or paste a key by hand' : 'Paste a key'}</summary>

			<ol class="steps">
				<li>
					Open SpaceBot, pick the *Space server, and go to <strong>API keys</strong>.
					{#if status.apiUrl}
						<a href={`${status.apiUrl}/admin`} target="_blank" rel="noopener noreferrer"
							>Open SpaceBot</a
						>
					{/if}
				</li>
				<li>
					Create a key with <code>voice:read</code>, <code>stats:read</code>,
					<code>channels:read</code> and <code>commands:read</code>.
				</li>
				<li>Paste it here.</li>
			</ol>

			<form class="form" on:submit|preventDefault={() => send('POST', { apiUrl, apiKey, channel })}>
				<label>
					<span>SpaceBot address</span>
					<input class="mono" bind:value={apiUrl} placeholder="https://spacebot.starspace.group" />
				</label>
				<label>
					<span>API key</span>
					<input
						class="mono"
						type="password"
						bind:value={apiKey}
						autocomplete="off"
						spellcheck="false"
						placeholder="sb_live_…"
					/>
				</label>
				<label>
					<span>Voice channel</span>
					<input bind:value={channel} placeholder="Ten Forward" />
				</label>
				<button class="btn btn-primary" type="submit" disabled={busy || !apiKey}>
					{busy ? 'Connecting…' : 'Connect'}
				</button>
			</form>
		</details>

		<p class="note">
			The key is stored on the server and never sent to a browser again — this page only ever shows
			the last four characters. Setting <code>SPACEBOT_API_URL</code> and
			<code>SPACEBOT_API_KEY</code> as environment variables still works and takes over if nothing is
			connected here.
		</p>
	</section>
</div>

<style>
	.page {
		max-width: 44rem;
		padding: var(--spacing-lg) 0;
	}

	.head h1 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.75rem;
	}

	.lede {
		margin: 0 0 var(--spacing-lg);
		color: var(--color-text-secondary);
	}

	.card {
		margin-bottom: var(--spacing-lg);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
	}

	h2 {
		margin: 0 0 var(--spacing-md);
		font-size: 1.125rem;
	}

	.card-head h2 {
		margin: 0;
	}

	.pill {
		padding: 0.15rem 0.6rem;
		border: 1px solid transparent;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.pill-on {
		border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
		color: var(--color-success);
	}

	.pill-off {
		border-color: var(--color-border);
		background: var(--color-background);
		color: var(--color-text-secondary);
	}

	.facts {
		display: grid;
		gap: var(--spacing-sm);
		margin: 0 0 var(--spacing-md);
	}

	.facts div {
		display: flex;
		gap: var(--spacing-sm);
		font-size: 0.9rem;
	}

	dt {
		min-width: 7rem;
		color: var(--color-text-secondary);
	}

	dd {
		margin: 0;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.scopes {
		display: grid;
		gap: var(--spacing-sm);
		margin: 0 0 var(--spacing-md);
		padding: 0;
		list-style: none;
	}

	.scopes li {
		display: grid;
		grid-template-columns: 8rem auto;
		gap: 0.15rem var(--spacing-sm);
		padding: var(--spacing-sm);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: inset 0 0 0 1px var(--color-border);
		font-size: 0.9rem;
	}

	.scopes span {
		color: var(--color-text-secondary);
	}

	.scope-ok span {
		color: var(--color-success);
	}

	.scopes em {
		grid-column: 1 / -1;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-style: normal;
	}

	.empty {
		margin: 0 0 var(--spacing-md);
		color: var(--color-text-secondary);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.btn:hover:not(:disabled) {
		border-color: var(--color-primary);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn-primary {
		border-color: transparent;
		background: var(--color-primary);
		color: #ffffff;
	}

	.btn-danger:hover:not(:disabled) {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	.message {
		margin: var(--spacing-md) 0 0;
		font-size: 0.9rem;
		color: var(--color-success);
	}

	.message-bad {
		color: var(--color-danger);
	}

	.steps {
		margin: 0 0 var(--spacing-md);
		padding-left: 1.2rem;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		line-height: 1.7;
	}

	.form {
		display: grid;
		gap: var(--spacing-md);
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	input {
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9rem;
	}

	.one-click {
		margin-bottom: 1.25rem;
	}

	.one-click .note {
		margin-top: 0.5rem;
	}

	.manual summary {
		cursor: pointer;
		font-size: 0.9rem;
		opacity: 0.85;
		margin-bottom: 0.75rem;
	}

	.outcome {
		margin: 0 0 1rem;
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
		border: 1px solid currentColor;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.outcome.failed {
		color: #ef4444;
	}

	.form button {
		justify-self: start;
	}

	.connect-facts {
		display: grid;
		gap: var(--spacing-xs);
		margin: var(--spacing-md) 0;
	}

	.connect-facts div {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.connect-facts dt {
		min-width: 8rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.connect-facts dd {
		margin: 0;
		font-size: 0.875rem;
		word-break: break-all;
	}

	.unavailable {
		margin: 0 0 var(--spacing-md);
		padding: var(--spacing-md);
		border: 1px solid color-mix(in srgb, var(--color-warning) 45%, transparent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning) 10%, transparent);
		line-height: 1.6;
	}

	.note {
		margin: var(--spacing-md) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		line-height: 1.6;
	}
</style>
