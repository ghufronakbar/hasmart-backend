# Module Transaction.Sales (Revised)

## 1. Overview

**TransactionSalesService** adalah service inti untuk operasional kasir (Point of Sales). Service ini menangani penjualan barang dari cabang ke customer. Transaksi ini akan **mengurangi stok** gudang.

## 2. Dependencies

- **RefreshStockService:** `src/modules/transaction/refresh-stock/refresh-stock.service.ts` (Method: `refreshRealStock`).
- **PrismaService:** Untuk database transaction.
- **GeneratorUtil:** Helper untuk generate nomor invoice otomatis.

## 3. Input Data Shape (DTO Expectation)

_Note: `invoiceNumber` digenerate oleh Backend._

```json
{
  "branchId": 1,
  "transactionDate": "2026-01-27T10:30:00Z", // Waktu transaksi
  "notes": "Customer minta bon kosong",
  "masterMemberId": 101, // Optional (Nullable)
  "items": [
    {
      "masterItemId": 10,
      "masterItemVariantId": 5, // Variant: Pack
      "qty": 2,
      "salesPrice": 55000, // Harga jual saat transaksi
      "discounts": [
        // Diskon per item (Promo produk)
        { "percentage": 10 }
      ]
    }
  ]
}
```

## 4. Logic Flow & Business Rules

### A. Invoice Generation

Generate **Invoice Number** yang unik sebelum simpan.

- Format: `TS-{YYYYMMDD}-{SEQUENCE}` (Contoh: `TS-20260127-0001`).

### B. Validation Phase

1. **Unique Items Check:** Validasi bahwa `masterItemVariantId` dalam payload `items` harus unique.
2. **Existence Check:**

- Query `masterItemVariant` (filter `deletedAt: null`).
- Validasi kelengkapan data.
- Simpan data variant (terutama `amount` konversi) ke dalam Map.

### C. Calculation & Transformation Phase

Lakukan mapping payload menjadi object Prisma.

**1. Item Calculation (`TransactionSalesItem`):**

- **Conversion:** Ambil `amount` dari MasterVariant -> `recordedConversion`.
- **Total Qty:** `payload.qty` \* `recordedConversion`.
- **Financials:**
- `recordedSubTotalAmount` = `payload.qty` \* `payload.salesPrice`.
- **Loop Discounts:**
- Iterasi `discounts`.
- Assign `orderIndex` (1, 2, ...).
- Hitung nominal diskon.
- `recordedDiscountAmount` = Total diskon item.

- `recordedTotalAmount` = `recordedSubTotalAmount` - `recordedDiscountAmount`.

**2. Header Calculation (`TransactionSales`):**

- `recordedSubTotalAmount` = Sum of all items' `recordedSubTotalAmount`.
- `recordedDiscountAmount` = Sum of all items' `recordedDiscountAmount`.
- `recordedTotalAmount` = `recordedSubTotalAmount` - `recordedDiscountAmount`.

### D. Database Transaction (Atomic Operation)

Gunakan `prisma.$transaction`:

1. **CRUD Operation:**

- **Create:**

```typescript
prisma.transactionSales.create({
  data: {
    invoiceNumber: generatedInvoiceNumber,
    // ... header fields calculated above
    transactionSalesItems: {
      create: items.map((item) => ({
        // ... item fields
        transactionSalesDiscounts: {
          create: item.discounts.map((d, index) => ({
            percentage: d.percentage,
            recordedAmount: d.calculatedAmount,
            orderIndex: index + 1,
          })),
        },
      })),
    },
  },
});
```

- **Update:** Gunakan strategi _Delete (Items) then Insert (Items)_. Keep invoice number lama.
- **Delete:** Soft delete.

2. **Post-Process (Parallel Execution):**

- **Refresh Stock:** Panggil `RefreshStockService.refreshRealStock` (Sales = Stock Berkurang).
- **Record Action:** Insert ke tabel `RecordAction` (Type: `TRANSACTION_SALES`).

## 5. Security & Notes

- **Middleware:** Wajib Auth.
- **Performance:** Optimasi query variant karena High Traffic.
