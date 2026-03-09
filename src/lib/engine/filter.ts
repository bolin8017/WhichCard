import type { CreditCard, StoreRestriction, RewardRule } from '$lib/types';

export function isCardAccepted(
	card: CreditCard,
	storeName: string,
	restrictions: Record<string, StoreRestriction>
): boolean {
	const r = restrictions[storeName];
	if (!r) return true;

	if (r.networks?.length && !r.networks.some((n) => card.network.includes(n))) {
		return false;
	}
	if (r.banks?.length && !r.banks.includes(card.bank)) {
		return false;
	}
	if (r.cards?.length && !r.cards.includes(card.id)) {
		return false;
	}

	return true;
}

export function isRuleActive(rule: RewardRule): boolean {
	const today = new Date().toISOString().slice(0, 10);

	if (rule.validUntil && rule.validUntil < today) {
		return false;
	}
	if (rule.validFrom && rule.validFrom > today) {
		return false;
	}

	return true;
}

export function isExcluded(storeName: string, rule: RewardRule): boolean {
	if (!rule.excludes) return false;
	return rule.excludes.includes(storeName);
}
