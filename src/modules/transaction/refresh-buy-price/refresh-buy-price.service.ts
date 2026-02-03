import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

export class RefreshBuyPriceService extends BaseService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Menghitung ulang harga beli (Average Cost) dari nol
   * Mengupdate MasterItem.recordedBuyPrice (Base Unit)
   * Mengupdate semua Variant (Profit & Percentage)
   */
  refreshBuyPrice = async (masterItemId: number) => {
    // 1. Jalankan kalkulasi berat di Database (Aggregate)
    const [purchaseAgg, returnAgg, variants] = await Promise.all([
      // Sum Total Beli
      this.prisma.transactionPurchaseItem.aggregate({
        _sum: {
          totalQty: true,
          recordedAfterTaxAmount: true,
        },
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          transactionPurchase: { deletedAt: null },
        },
      }),

      // Sum Total Retur Beli
      this.prisma.transactionPurchaseReturnItem.aggregate({
        _sum: {
          totalQty: true,
          recordedTotalAmount: true,
        },
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          transactionPurchaseReturn: { deletedAt: null },
        },
      }),

      // Ambil SEMUA variant
      this.prisma.masterItemVariant.findMany({
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          masterItem: { deletedAt: null },
        },
        select: {
          id: true,
          amount: true,
          sellPrice: true,
        },
      }),
    ]);

    console.log("purchaseAgg", purchaseAgg);
    console.log("returnAgg", returnAgg);
    console.log("variants", variants);

    // 2. Hitung Average Buy Price (Base Unit) using Decimal methods
    const purchaseQty = purchaseAgg._sum.totalQty ?? 0;
    const returnQty = returnAgg._sum.totalQty ?? 0;
    const totalQty = purchaseQty - returnQty;

    // Use Decimal for financial calculations
    const purchaseAmount =
      purchaseAgg._sum.recordedAfterTaxAmount ?? new Decimal(0);
    const returnAmount = returnAgg._sum.recordedTotalAmount ?? new Decimal(0);
    const totalAmount = purchaseAmount.sub(returnAmount);

    let avgBuyPriceBaseUnit = new Decimal(0);
    if (totalQty > 0) {
      avgBuyPriceBaseUnit = totalAmount.div(totalQty);
    }

    // 3. Lakukan Update secara ATOMIC & PARALEL
    await this.prisma.$transaction(async (tx) => {
      const updatePromises: Promise<unknown>[] = [];

      // A. Push Promise Update Master Item (Base Price)
      const updateMasterPromise = tx.masterItem.update({
        where: { id: masterItemId },
        data: {
          recordedBuyPrice: avgBuyPriceBaseUnit,
        },
      });
      updatePromises.push(updateMasterPromise);

      // B. Push Promise Update Semua Variant
      for (const variant of variants) {
        // Hitung Modal per Varian (Base Price * Konversi) using Decimal.mul()
        const variantCostPrice = avgBuyPriceBaseUnit.mul(variant.amount);

        // Hitung Profit using Decimal.sub()
        const profitAmount = variant.sellPrice.sub(variantCostPrice);
        let profitPercentage = new Decimal(0);

        // Hindari division by zero saat hitung persen
        if (variantCostPrice.gt(0)) {
          // (profitAmount / variantCostPrice) * 100
          profitPercentage = profitAmount.div(variantCostPrice).mul(100);
        }

        // Push ke array (JANGAN di-await disini)
        const updateVariantPromise = tx.masterItemVariant.update({
          where: { id: variant.id },
          data: {
            recordedBuyPrice: variantCostPrice,
            recordedProfitAmount: profitAmount,
            recordedProfitPercentage: profitPercentage,
          },
        });

        updatePromises.push(updateVariantPromise);
      }

      // C. Eksekusi semua query secara paralel dalam satu transaksi
      // Jika satu gagal, semua rollback otomatis.
      await Promise.all(updatePromises);
    });
  };
}
