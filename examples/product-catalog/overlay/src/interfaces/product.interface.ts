export interface Product {
	sku: string;
	name: string;
	category: string;
	description: string;
	price: string;
	badge: string;
	availability: string;
	detailOne: string;
	detailTwo: string;
	image: ProductImage | null;
	sortOrder: number;
}

export interface ProductImage {
	name: string;
	url: string;
}
