import { createSearchEngine, type SearchEngine, type SearchResults } from '$lib/engine/search';
import type { CreditCard, Aliases, StoreRestriction, Region } from '$lib/types';

let engine: SearchEngine | null = null;

export function initSearchEngine(
	cards: CreditCard[],
	aliases: Aliases,
	restrictions: Record<string, StoreRestriction>
): void {
	engine = createSearchEngine(cards, aliases, restrictions);
}

const emptyResults: SearchResults = {
	specificMatches: [],
	generalMatches: [],
	matchedStores: []
};

let query = $state('');
let region: Region = $state('domestic');
let myCardIds: string[] | undefined = $state(undefined);

export const searchStore = {
	get query() {
		return query;
	},
	set query(value: string) {
		query = value;
	},
	get region() {
		return region;
	},
	set region(value: Region) {
		region = value;
	},
	get myCardIds() {
		return myCardIds;
	},
	set myCardIds(value: string[] | undefined) {
		myCardIds = value;
	},
	get results(): SearchResults {
		if (!query.trim() || !engine) return emptyResults;
		return engine.search({ query, region, myCardIds });
	},
	get suggestions(): string[] {
		if (!query.trim() || !engine) return [];
		return engine.getAutocompleteSuggestions(query).slice(0, 5);
	}
};
