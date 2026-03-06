import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myCardsStore } from '$lib/stores/myCards.svelte';

const mockStorage = new Map<string, string>();

beforeEach(() => {
	mockStorage.clear();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => mockStorage.get(key) ?? null,
		setItem: (key: string, value: string) => mockStorage.set(key, value),
		removeItem: (key: string) => mockStorage.delete(key)
	});
	myCardsStore.clear();
});

describe('myCardsStore', () => {
	it('starts with no cards selected', () => {
		expect(myCardsStore.selectedCardIds).toHaveLength(0);
		expect(myCardsStore.count).toBe(0);
	});

	it('toggle adds a card', () => {
		myCardsStore.toggle('sinopac-dawho');
		expect(myCardsStore.isSelected('sinopac-dawho')).toBe(true);
		expect(myCardsStore.count).toBe(1);
	});

	it('toggle removes an already selected card', () => {
		myCardsStore.toggle('sinopac-dawho');
		myCardsStore.toggle('sinopac-dawho');
		expect(myCardsStore.isSelected('sinopac-dawho')).toBe(false);
		expect(myCardsStore.count).toBe(0);
	});

	it('persists to localStorage on toggle', () => {
		myCardsStore.toggle('cathay-costco');
		const stored = JSON.parse(mockStorage.get('whichcard-my-cards') ?? '[]');
		expect(stored).toContain('cathay-costco');
	});

	it('isFilterActive defaults to false', () => {
		expect(myCardsStore.isFilterActive).toBe(false);
	});

	it('isFilterActive can be toggled', () => {
		myCardsStore.isFilterActive = true;
		expect(myCardsStore.isFilterActive).toBe(true);
	});

	it('clear removes all cards', () => {
		myCardsStore.toggle('a');
		myCardsStore.toggle('b');
		myCardsStore.clear();
		expect(myCardsStore.count).toBe(0);
	});
});
