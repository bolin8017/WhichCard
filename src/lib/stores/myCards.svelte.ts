const STORAGE_KEY = 'whichcard-my-cards';

function loadFromStorage(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveToStorage(ids: string[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

let selectedCardIds: string[] = $state(loadFromStorage());
let isFilterActive = $state(false);

export const myCardsStore = {
	get selectedCardIds() {
		return selectedCardIds;
	},
	get isFilterActive() {
		return isFilterActive;
	},
	set isFilterActive(value: boolean) {
		isFilterActive = value;
	},
	get count() {
		return selectedCardIds.length;
	},
	toggle(cardId: string): void {
		const index = selectedCardIds.indexOf(cardId);
		if (index >= 0) {
			selectedCardIds = selectedCardIds.filter((id) => id !== cardId);
		} else {
			selectedCardIds = [...selectedCardIds, cardId];
		}
		saveToStorage(selectedCardIds);
	},
	isSelected(cardId: string): boolean {
		return selectedCardIds.includes(cardId);
	},
	clear(): void {
		selectedCardIds = [];
		saveToStorage(selectedCardIds);
	}
};
