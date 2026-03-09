import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import SearchBar from '$components/SearchBar.svelte';
import { searchStore } from '$lib/stores/search.svelte';
import { setupTestEngine } from './setup';

beforeEach(() => {
	setupTestEngine();
	searchStore.query = '';
});

describe('SearchBar', () => {
	it('renders input with placeholder', () => {
		render(SearchBar);
		expect(screen.getByPlaceholderText('輸入商家或通路名稱...')).toBeInTheDocument();
	});

	it('shows clear button when input has text', async () => {
		const user = userEvent.setup();
		render(SearchBar);
		const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
		await user.type(input, 'momo');
		expect(screen.getByLabelText('清除搜尋')).toBeInTheDocument();
	});

	it('clears input on clear button click', async () => {
		const user = userEvent.setup();
		render(SearchBar);
		const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
		await user.type(input, 'momo');
		await user.click(screen.getByLabelText('清除搜尋'));
		expect(searchStore.query).toBe('');
	});

	it('syncs input value when store query is set externally', async () => {
		render(SearchBar);
		const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
		// Simulate a popular-search chip click setting the store directly
		searchStore.query = 'momo';
		// Svelte needs a tick to re-render
		await new Promise((r) => setTimeout(r, 0));
		expect((input as HTMLInputElement).value).toBe('momo');
	});

	it('ArrowDown highlights first suggestion; Enter selects it', async () => {
		const user = userEvent.setup();
		render(SearchBar);
		const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
		await user.type(input, 'mo');
		// A suggestion for 'momo' should appear (testAliases has momo)
		const suggestions = screen.queryAllByRole('option');
		expect(suggestions.length).toBeGreaterThan(0);
		await user.keyboard('{ArrowDown}');
		// First suggestion should now be highlighted (aria-selected true)
		expect(suggestions[0]).toHaveAttribute('aria-selected', 'true');
		await user.keyboard('{Enter}');
		expect(searchStore.query).toBe('momo');
	});

	it('Escape closes suggestions without clearing query', async () => {
		const user = userEvent.setup();
		render(SearchBar);
		const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
		await user.type(input, 'mo');
		expect(screen.queryAllByRole('option').length).toBeGreaterThan(0);
		await user.keyboard('{Escape}');
		expect(screen.queryAllByRole('option')).toHaveLength(0);
		expect(searchStore.query).toBe('mo');
	});
});
