<script lang="ts">
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	function formatDate(value: string): string {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
	}

	const filters = [
		{ value: null, label: 'All' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'rejected', label: 'Rejected' }
	] as const;

	const href = (status: string | null) =>
		status ? `/admin/project-submissions?status=${status}` : '/admin/project-submissions';

	const pageHref = (page: number) =>
		`/admin/project-submissions?page=${page}${data.status ? `&status=${data.status}` : ''}`;
</script>

<svelte:head>
	<title>Project Submissions | Admin</title>
</svelte:head>

<div class="page-header">
	<h1>Project Submissions</h1>
	<nav class="filters" aria-label="Filter by status">
		{#each filters as f (f.label)}
			<a href={href(f.value)} class:active={data.status === f.value}>{f.label}</a>
		{/each}
	</nav>
</div>

<p class="count">
	{data.total} submission{data.total === 1 ? '' : 's'}{#if data.status === null && data.pending}, {data.pending}
		waiting{/if}
</p>

<p class="hint">
	Approving records the decision for the member. The card itself still goes into
	<code>src/lib/data/projects.ts</code> — the directory is checked-in data.
</p>

{#if form?.error}
	<div class="banner banner-error" role="alert">{form.error}</div>
{:else if form?.reviewed}
	<div class="banner banner-success" role="status">Marked {form.status}.</div>
{/if}

{#if data.submissions.length === 0}
	<p class="empty">Nothing {data.status ?? ''} here.</p>
{:else}
	<ul class="list">
		{#each data.submissions as s (s.id)}
			<li class="card">
				<div class="card-head">
					<h2>{s.name}</h2>
					<span class="badge badge-{s.status}">{s.status}</span>
				</div>
				<a class="url" href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.url}</a>
				<p class="description">{s.description}</p>
				{#if s.notes}
					<p class="notes"><strong>Notes for you:</strong> {s.notes}</p>
				{/if}
				<p class="meta">
					Sent {formatDate(s.createdAt)} · Discord user <code>{s.discordUserId}</code>
					{#if s.reviewedAt}
						· Reviewed {formatDate(s.reviewedAt)}{#if s.reviewNote}: “{s.reviewNote}”{/if}
					{/if}
				</p>
				{#if s.status === 'pending'}
					<form method="POST" class="review">
						<input type="hidden" name="id" value={s.id} />
						<input
							type="text"
							name="note"
							maxlength="500"
							placeholder="A line for the member, optional"
							aria-label="Note to the member"
						/>
						<button type="submit" formaction="?/approve" class="btn btn-approve">Approve</button>
						<button type="submit" formaction="?/reject" class="btn btn-reject">Reject</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	{#if data.totalPages > 1}
		<div class="pagination">
			{#if data.page > 1}<a href={pageHref(data.page - 1)}>← Prev</a>{/if}
			<span>Page {data.page} of {data.totalPages}</span>
			{#if data.page < data.totalPages}<a href={pageHref(data.page + 1)}>Next →</a>{/if}
		</div>
	{/if}
{/if}

<style>
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		flex-wrap: wrap;
		margin-bottom: var(--spacing-sm);
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.filters {
		display: flex;
		gap: var(--spacing-xs);
	}

	.filters a {
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.filters a.active {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.count,
	.hint,
	.empty {
		color: var(--color-text-secondary);
		margin: 0 0 var(--spacing-md);
	}

	.banner {
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
		font-size: 0.95rem;
	}

	.banner-success {
		background: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.banner-error {
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.card {
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.card h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.badge {
		font-size: 0.75rem;
		text-transform: capitalize;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.badge-approved {
		color: var(--color-success);
		border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
	}

	.badge-rejected {
		color: var(--color-error);
		border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
	}

	.url {
		display: inline-block;
		margin: var(--spacing-xs) 0;
		color: var(--color-primary);
		word-break: break-all;
	}

	.description {
		margin: var(--spacing-sm) 0;
	}

	.notes,
	.meta {
		margin: var(--spacing-xs) 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.review {
		display: flex;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
		margin-top: var(--spacing-md);
	}

	.review input {
		flex: 1 1 16rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-approve {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.btn-reject {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text);
	}

	.pagination {
		display: flex;
		gap: var(--spacing-md);
		align-items: center;
		margin-top: var(--spacing-lg);
		color: var(--color-text-secondary);
	}
</style>
