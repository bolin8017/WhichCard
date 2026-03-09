import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import MyCardsToggle from '$components/MyCardsToggle.svelte';
import { myCardsStore } from '$lib/stores/myCards.svelte';

beforeEach(() => {
	myCardsStore.isFilterActive = false;
});

describe('MyCardsToggle', () => {
	it('renders checkbox with label', () => {
		render(MyCardsToggle);
		expect(screen.getByText('只顯示我的卡片')).toBeInTheDocument();
		expect(screen.getByRole('checkbox')).not.toBeChecked();
	});

	it('toggles filter on click', async () => {
		const user = userEvent.setup();
		render(MyCardsToggle);
		await user.click(screen.getByRole('checkbox'));
		expect(myCardsStore.isFilterActive).toBe(true);
	});
});
