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
});
