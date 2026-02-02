import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";

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

    // 2. Hitung Average Buy Price (Base Unit)
    const totalQty =
      (purchaseAgg._sum.totalQty ?? 0) - (returnAgg._sum.totalQty ?? 0);
    const totalAmount =
      (purchaseAgg._sum.recordedAfterTaxAmount ?? 0) -
      (returnAgg._sum.recordedTotalAmount ?? 0);

    let avgBuyPriceBaseUnit = 0;
    if (totalQty > 0) {
      avgBuyPriceBaseUnit = totalAmount / totalQty;
    }

    const finalBuyPriceInt = Math.round(avgBuyPriceBaseUnit);

    // 3. Lakukan Update secara ATOMIC & PARALEL
    await this.prisma.$transaction(async (tx) => {
      const updatePromises: Promise<unknown>[] = [];

      // A. Push Promise Update Master Item (Base Price)
      const updateMasterPromise = tx.masterItem.update({
        where: { id: masterItemId },
        data: {
          recordedBuyPrice: finalBuyPriceInt,
        },
      });
      updatePromises.push(updateMasterPromise);

      // B. Push Promise Update Semua Variant
      for (const variant of variants) {
        // Hitung Modal per Varian (Base Price * Konversi)
        const variantCostPrice = finalBuyPriceInt * variant.amount;

        // Hitung Profit
        const profitAmount = variant.sellPrice - variantCostPrice;
        let profitPercentage = 0;

        // Hindari division by zero saat hitung persen
        if (variantCostPrice > 0) {
          profitPercentage = (profitAmount / variantCostPrice) * 100;
        }

        // Push ke array (JANGAN di-await disini)
        const updateVariantPromise = tx.masterItemVariant.update({
          where: { id: variant.id },
          data: {
            recordedBuyPrice: variantCostPrice,
            recordedProfitAmount: Math.round(profitAmount),
            recordedProfitPercentage: Math.round(profitPercentage),
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
