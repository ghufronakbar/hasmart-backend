# Item Module

Module untuk mengelola master item (MasterItem) dan variant-nya (MasterItemVariant).

---

## Overview

Module ini menyediakan CRUD operations untuk entity `MasterItem` dan nested CRUD untuk `MasterItemVariant`. Mendukung query stok berdasarkan branch.

---

## Files

| File                 | Description                          |
| -------------------- | ------------------------------------ |
| `item.controller.ts` | HTTP request/response handlers       |
| `item.service.ts`    | Business logic & database operations |
| `item.route.ts`      | Route definitions                    |
| `item.validator.ts`  | Zod validation schemas               |
| `item.interface.ts`  | Response type interfaces             |

---

## Dependency

- `common/prisma` - Database access
- `common/jwt` - Auth middleware

---

## API Endpoints

### List Items

```
GET /api/master/item
Authorization: Bearer <token>
```

**Query Parameters:**

- `search` - Search by name
- `page`, `limit`, `sort`, `sortBy` - Pagination
- `branchId` (optional) - Filter stock by branch

**Response:** Includes `stock` field (global atau branch-specific berdasarkan query)

---

### Get Item by ID

```
GET /api/master/item/:masterItemId
Authorization: Bearer <token>
```

**Query Parameters:**

- `branchId` (optional) - Get stock for specific branch

---

### Create Item

```
POST /api/master/item
Authorization: Bearer <token>
```

**Body:**

```json
{
  "name": "Detergen Merk ABC",
  "masterSupplierId": 1,
  "masterItemCategoryId": 1,
  "isActive": true,
  "masterItemVariants": [
    {
      "code": "DET001",
      "unit": "PCS",
      "amount": 1,
      "sellPrice": 15000,
      "isBaseUnit": true
    },
    {
      "code": "DET002",
      "unit": "PACK",
      "amount": 12,
      "sellPrice": 170000,
      "isBaseUnit": false
    }
  ]
}
```

> **Note:** Minimal harus ada 1 variant. Jika code variant sudah ada (soft deleted), akan di-restore.

---

### Update Item

```
PUT /api/master/item/:masterItemId
Authorization: Bearer <token>
```

**Body:**

```json
{
  "name": "Detergen Merk ABC Updated",
  "masterSupplierId": 1,
  "masterItemCategoryId": 1,
  "isActive": true
}
```

> **Note:** Update hanya untuk MasterItem, tidak termasuk variants.

---

### Delete Item

```
DELETE /api/master/item/:masterItemId
Authorization: Bearer <token>
```

---

## Variant Endpoints

### Add Variant

```
POST /api/master/item/:masterItemId/variant
Authorization: Bearer <token>
```

**Body:**

```json
{
  "code": "DET003",
  "unit": "BOX",
  "amount": 48,
  "sellPrice": 650000,
  "isBaseUnit": false
}
```

---

### Update Variant

```
PUT /api/master/item/:masterItemId/variant/:masterItemVariantId
Authorization: Bearer <token>
```

**Body:** Same as Add Variant

---

### Delete Variant

```
DELETE /api/master/item/:masterItemId/variant/:masterItemVariantId
Authorization: Bearer <token>
```

> **Note:** Tidak bisa delete jika hanya tinggal 1 variant.

---

### Get Variant By Code

Retrieve a specific variant by its unique code.

```
GET /api/master/item/:masterItemCode/variant
Authorization: Bearer <token>
```

**Parameters:**

- `masterItemCode` (Path Param) - The code of the variant (e.g. `DET001`). Note: In this route, the parameter is named `masterItemCode` but it maps to the **Variant Code**.

**Response:**

Returns `MasterItemVariant` object including `masterItem`.

## Response Interface

```typescript
interface ItemResponse {
  id: number;
  name: string;
  masterItemCategoryId: number;
  masterSupplierId: number;
  isActive: boolean;
  recordedBuyPrice: number;
  stock: number; // Global stock atau branch-specific
  masterItemCategory: { id; code; name };
  masterSupplier: { id; code; name };
  masterItemVariants: ItemVariantResponse[];
  createdAt: Date;
  updatedAt: Date;
}
```

> **Important:** Key `stock` selalu sama, baik tanpa/dengan `branchId`. Nilainya berbeda berdasarkan query.

---

## Business Rules

- Supplier dan Category harus valid (tidak deleted)
- Variant code harus unique secara global
- Variant code otomatis uppercase
- Jika create dengan code yang sudah di-soft-delete, akan restore
- Item harus memiliki minimal 1 variant
- Soft delete dengan `deletedAt`

---

## Database Models

- `MasterItem` - Item master data
- `MasterItemVariant` - Unit/packaging variants
- `ItemBranch` - Stock per branch (pivot)
