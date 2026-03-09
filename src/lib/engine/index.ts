import type { CreditCard, Aliases } from '$lib/types';

export interface RuleRef {
	cardIndex: number;
	ruleIndex: number;
}

export type StoreIndex = Map<string, RuleRef[]>;
export type PrefixIndex = Map<string, string[]>;

export function buildStoreIndex(cards: CreditCard[]): StoreIndex {
	const index: StoreIndex = new Map();
	cards.forEach((card, cardIndex) => {
		card.rewards.forEach((rule, ruleIndex) => {
			const ref: RuleRef = { cardIndex, ruleIndex };
			for (const store of rule.stores) {
				const existing = index.get(store) ?? [];
				existing.push(ref);
				index.set(store, existing);
			}
		});
	});
	return index;
}

export function buildPrefixIndex(aliases: Aliases): PrefixIndex {
	const index: PrefixIndex = new Map();

	function addPrefixes(text: string, canonical: string): void {
		const lower = text.toLowerCase();
		for (let i = 1; i <= lower.length; i++) {
			const prefix = lower.slice(0, i);
			const existing = index.get(prefix) ?? [];
			if (!existing.includes(canonical)) {
				existing.push(canonical);
			}
			index.set(prefix, existing);
		}
	}

	for (const [canonical, aliasList] of Object.entries(aliases)) {
		addPrefixes(canonical, canonical);
		for (const alias of aliasList) {
			addPrefixes(alias, canonical);
		}
	}

	return index;
}
