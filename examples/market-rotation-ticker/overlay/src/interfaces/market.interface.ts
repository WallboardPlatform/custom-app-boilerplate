import type { DataSourceKey } from '@interfaces/application.interface';

export type MarketKind = 'market-api' | 'tsx-feed' | 'fx-api';
export type MarketDirection = 'up' | 'down';

export interface MarketDefinition {
	id: string;
	dataSourceKey: DataSourceKey;
	kind: MarketKind;
	label: string;
}

export interface MarketStock {
	id: string;
	symbol: string;
	price: string;
	change: string;
	direction: MarketDirection;
}

export interface MarketSnapshot {
	id: string;
	label: string;
	stocks: MarketStock[];
}

export interface IconRecord {
	name: string;
	url: string;
}

export interface IconIndex {
	exact: Map<string, string>;
	normalized: Map<string, string>;
}
