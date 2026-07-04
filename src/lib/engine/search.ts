import type { CreditCard, Aliases, StoreRestriction, Region, RewardRule, Categories } from '$lib/types';
import { buildStoreIndex, buildPrefixIndex, type StoreIndex, type PrefixIndex } from './index';
import { resolveAlias } from './alias';
import { buildCategoryIndex, expandStores } from './category';
import { isCardAccepted, isRuleActive, isExcluded } from './filter';
import { computeMaxReward, getRuleMaxReward } from './scoring';

export interface SearchParams {
	query: string;
	region: Region;
	myCardIds?: string[];
}

export type MatchKind = 'store' | 'category' | 'wildcard';

export interface SearchResult {
	card: CreditCard;
	matchedRule: RewardRule;
	baseRule?: RewardRule;
	maxReward: number;
	isSpecificMatch: boolean;
	matchKind: MatchKind;
}

export interface SearchResults {
	specificMatches: SearchResult[];
	generalMatches: SearchResult[];
	matchedStores: string[];
	restriction?: StoreRestriction;
}

export interface SearchEngine {
	search(params: SearchParams): SearchResults;
	getAutocompleteSuggestions(query: string): string[];
}

export function createSearchEngine(
	cards: CreditCard[],
	aliases: Aliases,
	restrictions: Record<string, StoreRestriction>,
	categories: Categories = {}
): SearchEngine {
	const storeIndex = buildStoreIndex(cards);
	const prefixIndex = buildPrefixIndex(aliases);
	const categoryIndex = buildCategoryIndex(categories);

	function search(params: SearchParams): SearchResults {
		const { query, region, myCardIds } = params;
		if (!query.trim()) {
			return { specificMatches: [], generalMatches: [], matchedStores: [] };
		}

		// Stage 1: Alias resolution
		const aliasMatches = resolveAlias(query, aliases, prefixIndex);
		const matchedStores = aliasMatches.map((m) => m.canonical);

		if (matchedStores.length === 0) {
			return { specificMatches: [], generalMatches: [], matchedStores: [] };
		}

		// Find the first matched store's restriction (for display)
		const restriction = matchedStores
			.map((s) => restrictions[s])
			.find((r) => r !== undefined);

		// Stage 2+3+4: For each matched store, collect candidates
		const specificByCard = new Map<string, SearchResult>();
		const generalByCard = new Map<string, SearchResult>();

		for (const storeName of matchedStores) {
			const expanded = expandStores(storeName, categoryIndex);

			// Process specific matches: union of rules over the expanded set
			for (const name of expanded) {
				const kind: MatchKind = name === storeName ? 'store' : 'category';
				for (const ref of storeIndex.get(name) ?? []) {
					const card = cards[ref.cardIndex];
					const rule = card.rewards[ref.ruleIndex];

					if (!passesFilters(card, rule, expanded, storeName, region, restrictions, myCardIds))
						continue;

					// Find this card's wildcard rule for same region as baseRule
					const baseRule = findWildcardRule(card, region, expanded);

					const maxReward = computeMaxReward(rule, baseRule);

					const existing = specificByCard.get(card.id);
					const better =
						!existing ||
						maxReward > existing.maxReward ||
						(maxReward === existing.maxReward &&
							kind === 'store' &&
							existing.matchKind === 'category');
					if (better) {
						specificByCard.set(card.id, {
							card,
							matchedRule: rule,
							baseRule,
							maxReward,
							isSpecificMatch: true,
							matchKind: kind
						});
					}
				}
			}

			// Process wildcard matches (only for cards NOT already in specific)
			for (const ref of storeIndex.get('*') ?? []) {
				const card = cards[ref.cardIndex];
				const rule = card.rewards[ref.ruleIndex];

				if (specificByCard.has(card.id)) continue;
				if (!passesFilters(card, rule, expanded, storeName, region, restrictions, myCardIds))
					continue;

				const maxReward = getRuleMaxReward(rule);

				const existing = generalByCard.get(card.id);
				if (!existing || maxReward > existing.maxReward) {
					generalByCard.set(card.id, {
						card,
						matchedRule: rule,
						maxReward,
						isSpecificMatch: false,
						matchKind: 'wildcard'
					});
				}
			}
		}

		// Sort by maxReward descending
		const specificMatches = [...specificByCard.values()].sort(
			(a, b) => b.maxReward - a.maxReward
		);
		const generalMatches = [...generalByCard.values()].sort(
			(a, b) => b.maxReward - a.maxReward
		);

		return { specificMatches, generalMatches, matchedStores, restriction };
	}

	function passesFilters(
		card: CreditCard,
		rule: RewardRule,
		expanded: string[],
		storeName: string,
		region: Region,
		storeRestrictions: Record<string, StoreRestriction>,
		myCardIds?: string[]
	): boolean {
		if (rule.region !== region) return false;
		if (!isRuleActive(rule)) return false;
		if (isExcluded(expanded, rule)) return false;
		if (!isCardAccepted(card, storeName, storeRestrictions)) return false;
		if (myCardIds && !myCardIds.includes(card.id)) return false;
		return true;
	}

	function findWildcardRule(
		card: CreditCard,
		region: Region,
		expanded: string[]
	): RewardRule | undefined {
		return card.rewards.find(
			(r) =>
				r.stores.includes('*') &&
				r.region === region &&
				isRuleActive(r) &&
				!isExcluded(expanded, r)
		);
	}

	function getAutocompleteSuggestions(query: string): string[] {
		if (!query.trim()) return [];
		const lower = query.toLowerCase();
		return prefixIndex.get(lower) ?? [];
	}

	return { search, getAutocompleteSuggestions };
}
