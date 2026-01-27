import { MasterItem, MasterItemVariant, ItemBranch } from ".prisma/client";

// Database result types with includes
export interface ItemBranchSelect {
  branchId: number;
  recordedStock: number;
}

export interface CategorySelect {
  id: number;
  code: string;
  name: string;
}

export interface SupplierSelect {
  id: number;
  code: string;
  name: string;
}

export interface MasterItemWithIncludes extends MasterItem {
  masterItemCategory: CategorySelect;
  masterSupplier: SupplierSelect;
  masterItemVariants: MasterItemVariant[];
  itemBranches: ItemBranchSelect[];
}

// Response interfaces for consistent API responses
export interface ItemVariantResponse {
  id: number;
  code: string;
  unit: string;
  amount: number;
  recordedBuyPrice: number;
  sellPrice: number;
  isBaseUnit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemResponse {
  id: number;
  name: string;
  masterItemCategoryId: number;
  masterSupplierId: number;
  isActive: boolean;
  recordedBuyPrice: number;
  stock: number;
  masterItemCategory: CategorySelect;
  masterSupplier: SupplierSelect;
  masterItemVariants: ItemVariantResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemListResponse {
  id: number;
  name: string;
  masterItemCategoryId: number;
  masterSupplierId: number;
  isActive: boolean;
  recordedBuyPrice: number;
  stock: number;
  masterItemCategory: CategorySelect;
  masterSupplier: SupplierSelect;
  masterItemVariants: ItemVariantResponse[];
  createdAt: Date;
  updatedAt: Date;
}
