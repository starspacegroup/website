import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Footer from './Footer.svelte';
import { DISCORD_INVITE } from '$lib/discord';
import { site, repoUrl } from '$lib/site.config';

describe('Footer', () => {
	it('should render the footer element', () => {
		render(Footer);
		const footer = document.querySelector('footer');
		expect(footer).toBeInTheDocument();
	});

	it('should display the app brand', () => {
		render(Footer);
		expect(screen.getByText(site.name)).toBeInTheDocument();
	});

	it('should display the tagline', () => {
		render(Footer);
		expect(screen.getByText(site.tagline)).toBeInTheDocument();
	});

	it('should have navigation links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /navigation/i })).toBeInTheDocument();
	});

	it('should have community links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /community/i })).toBeInTheDocument();
	});

	it('should have legal links section', () => {
		render(Footer);
		expect(screen.getByRole('heading', { name: /legal/i })).toBeInTheDocument();
	});

	it('should contain home link', () => {
		render(Footer);
		const homeLink = screen.getByRole('link', { name: /^home$/i });
		expect(homeLink).toHaveAttribute('href', '/');
	});

	it('should contain chat link', () => {
		render(Footer);
		const chatLink = screen.getByRole('link', { name: /^chat$/i });
		expect(chatLink).toHaveAttribute('href', '/chat');
	});

	it('should contain chat link', () => {
		render(Footer);
		expect(screen.getByRole('link', { name: /^chat$/i })).toHaveAttribute('href', '/chat');
	});

	it('should link the documentation page', () => {
		render(Footer);
		expect(screen.getByRole('link', { name: /documentation/i })).toHaveAttribute(
			'href',
			'/documentation'
		);
	});

	it('should contain documentation link pointing to /documentation', () => {
		render(Footer);
		const docsLink = screen.getByRole('link', { name: /documentation/i });
		expect(docsLink).toHaveAttribute('href', '/documentation');
	});

	it('should contain GitHub link in resources', () => {
		render(Footer);
		const githubLinks = screen.getAllByRole('link', { name: /github/i });
		// At least one should be the text link in resources
		const resourcesLink = githubLinks.find((link) =>
			link.textContent?.toLowerCase().includes('github')
		);
		expect(resourcesLink).toHaveAttribute('href', repoUrl);
	});

	it('should contain privacy policy link', () => {
		render(Footer);
		const privacyLink = screen.getByRole('link', { name: /privacy/i });
		expect(privacyLink).toHaveAttribute('href', '/privacy');
	});

	it('should contain terms of service link', () => {
		render(Footer);
		const termsLink = screen.getByRole('link', { name: /terms/i });
		expect(termsLink).toHaveAttribute('href', '/terms');
	});

	it('should display copyright with current year', () => {
		render(Footer);
		const currentYear = new Date().getFullYear();
		expect(screen.getByText(new RegExp(`© ${currentYear}`, 'i'))).toBeInTheDocument();
	});

	// The site credits its author only when the author is someone else. Here the
	// site IS the author, so "© *Space. Created by *Space." would be noise.
	it('credits the author only when the author is not the site itself', () => {
		const { container } = render(Footer);
		// Scoped to the copyright line: the brand link in the footer logo carries
		// the same text, because on this site the author IS the site.
		const copyright = container.querySelector('.footer-copyright') as HTMLElement;
		const authorLink = within(copyright).queryByRole('link', { name: site.author });
		if (site.author === site.name) {
			expect(authorLink).not.toBeInTheDocument();
			return;
		}
		expect(authorLink).toHaveAttribute('href', site.authorUrl);
		expect(authorLink).toHaveAttribute('target', '_blank');
		expect(authorLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('should have proper accessibility structure with navigation landmark', () => {
		render(Footer);
		const nav = document.querySelector('footer nav');
		expect(nav).toBeInTheDocument();
		expect(nav).toHaveAttribute('aria-label', 'Footer navigation');
	});

	it('should have GitHub external link open in new tab', () => {
		render(Footer);
		const githubLinks = screen.getAllByRole('link', { name: /github/i });
		const resourcesLink = githubLinks.find((link) =>
			link.textContent?.toLowerCase().includes('github')
		);
		expect(resourcesLink).toHaveAttribute('target', '_blank');
		expect(resourcesLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('should render the brand badge', () => {
		render(Footer);
		expect(screen.getByText('Coworking on Discord')).toBeInTheDocument();
	});

	it('should link the community section to the Discord invite', () => {
		render(Footer);
		const discord = screen.getByRole('link', { name: 'Discord' });
		expect(discord).toHaveAttribute('href', DISCORD_INVITE);
		expect(discord).toHaveAttribute('target', '_blank');
		expect(discord).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('should link the projects page', () => {
		render(Footer);
		expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
	});
});
