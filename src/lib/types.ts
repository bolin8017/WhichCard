export const CARD_NETWORKS = ['visa', 'mastercard', 'jcb', 'amex'] as const;
export type CardNetwork = (typeof CARD_NETWORKS)[number];

export const REWARD_TYPES = ['現金回饋', '點數回饋'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const REGIONS = ['domestic', 'international', 'japan', 'korea', 'thailand'] as const;
export type Region = (typeof REGIONS)[number];

export const LIMIT_UNITS = ['元', '點'] as const;
export type LimitUnit = (typeof LIMIT_UNITS)[number];

export const CONDITION_TAGS = [
	'自動扣繳',
	'電子帳單',
	'行動支付',
	'指定通路',
	'最低消費',
	'新戶',
	'會員等級',
	'限期',
	'需登錄'
] as const;
export type ConditionTag = (typeof CONDITION_TAGS)[number];

export interface RewardTier {
	label: string;
	bonus: number;
	limit: number;
	limitUnit: LimitUnit;
	condition: string;
	tags?: ConditionTag[];
}

export interface RewardRule {
	stores: string[];
	storeLabel?: string;
	region: Region;
	rate: number;
	limit: number;
	limitUnit: LimitUnit;
	excludes?: string[];
	validFrom?: string;
	validUntil?: string;
	note?: string;
	tiers?: RewardTier[];
}

export interface CreditCard {
	id: string;
	name: string;
	bank: string;
	network: CardNetwork[];
	rewardType: RewardType;
	sourceUrl: string;
	updatedAt: string;
	note?: string;
	rewards: RewardRule[];
}

export interface StoreRestriction {
	networks?: CardNetwork[];
	banks?: string[];
	cards?: string[];
	note?: string;
}

export interface StoreEntry {
	name: string;
	restrictions: StoreRestriction;
	note?: string;
}

export type Aliases = Record<string, string[]>;

export interface SearchIndex {
	aliases: Aliases;
	storeRestrictions: Record<string, StoreRestriction>;
}
