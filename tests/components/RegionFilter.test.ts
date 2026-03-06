import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import RegionFilter from '$components/RegionFilter.svelte';
import { searchStore } from '$lib/stores/search.svelte';
import { setupTestEngine } from './setup';

beforeEach(() => {
	setupTestEngine();
	searchStore.region = 'domestic';
});

describe('RegionFilter', () => {
	it('renders all region buttons', () => {
		render(RegionFilter);
		expect(screen.getByText('國內')).toBeInTheDocument();
		expect(screen.getByText('國外')).toBeInTheDocument();
		expect(screen.getByText('日本')).toBeInTheDocument();
		expect(screen.getByText('韓國')).toBeInTheDocument();
		expect(screen.getByText('泰國')).toBeInTheDocument();
	});

	it('國內 is selected by default', () => {
		render(RegionFilter);
		expect(screen.getByText('國內').closest('button')).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});

	it('clicking a region changes selection', async () => {
		const user = userEvent.setup();
		render(RegionFilter);
		await user.click(screen.getByText('日本'));
		expect(searchStore.region).toBe('japan');
	});
});
