import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";

export class RefreshStockService extends BaseService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Menghitung ulang stok dari nol berdasarkan history transaksi
   * dan mengupdate nilai ItemBranch.recordedStock
   */
  refreshRealStock = async (branchId: number, masterItemId: number) => {
    this.prisma.$transaction(async (tx) => {});
    // Jalankan semua query agregasi secara paralel untuk performa
    const [
      purchases,
      purchaseReturns,
      sales,
      salesReturns,
      transfersIn,
      transfersOut,
      adjustments,
    ] = await Promise.all([
      // 1. Total Pembelian (+)
      this.prisma.transactionPurchaseItem.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          deletedAt: null, // Item tidak dihapus
          transactionPurchase: {
            branchId: branchId,
            deletedAt: null, // Transaksi induk tidak dihapus
          },
        },
      }),

      // 2. Total Retur Pembelian (-)
      this.prisma.transactionPurchaseReturnItem.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          transactionPurchaseReturn: {
            branchId: branchId,
            deletedAt: null,
          },
        },
      }),

      // 3. Total Penjualan (-)
      this.prisma.transactionSalesItem.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          transactionSales: {
            branchId: branchId,
            deletedAt: null,
          },
        },
      }),

      // 4. Total Retur Penjualan (+)
      this.prisma.transactionSalesReturnItem.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          deletedAt: null,
          transactionSalesReturn: {
            branchId: branchId,
            deletedAt: null,
          },
        },
      }),

      // 5. Transfer Masuk (+)
      this.prisma.transactionTransfer.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          toId: branchId, // Cabang sebagai penerima
          deletedAt: null,
        },
      }),

      // 6. Transfer Keluar (-)
      this.prisma.transactionTransfer.aggregate({
        _sum: { totalQty: true },
        where: {
          masterItemId: masterItemId,
          fromId: branchId, // Cabang sebagai pengirim
          deletedAt: null,
        },
      }),

      // 7. Adjustment (+/- tergantung nilai gapAmount)
      this.prisma.transactionAdjustment.aggregate({
        _sum: { totalGapAmount: true },
        where: {
          masterItemId: masterItemId,
          branchId: branchId,
          deletedAt: null,
        },
      }),
    ]);

    // Ekstrak nilai (handle null jika tidak ada data)
    const totalPurchase = purchases._sum.totalQty ?? 0;
    const totalPurchaseReturn = purchaseReturns._sum.totalQty ?? 0;
    const totalSales = sales._sum.totalQty ?? 0;
    const totalSalesReturn = salesReturns._sum.totalQty ?? 0;
    const totalTransferIn = transfersIn._sum.totalQty ?? 0;
    const totalTransferOut = transfersOut._sum.totalQty ?? 0;

    // Adjustment dijumlahkan karena asumsinya nilai totalGapAmount
    // sudah positif (stok lebih) atau negatif (stok kurang) di database
    const totalAdjustment = adjustments._sum.totalGapAmount ?? 0;

    // Rumus Stok Akhir
    // Masuk: Purchase + Sales Return + Transfer In + Adjustment (jika positif)
    // Keluar: Sales + Purchase Return + Transfer Out + Adjustment (jika negatif)
    const finalStock =
      totalPurchase +
      totalSalesReturn +
      totalTransferIn +
      totalAdjustment -
      (totalSales + totalPurchaseReturn + totalTransferOut);

    // Update ke ItemBranch (Gunakan Upsert untuk jaga-jaga jika record belum ada)
    // Walaupun idealnya record ItemBranch harusnya sudah ada jika transaksi ada
    const updatedItemBranch = await this.prisma.itemBranch.upsert({
      where: {
        masterItemId_branchId: {
          masterItemId: masterItemId,
          branchId: branchId,
        },
      },
      update: {
        recordedStock: finalStock,
      },
      create: {
        masterItemId: masterItemId,
        branchId: branchId,
        recordedStock: finalStock,
      },
    });

    return updatedItemBranch;
  };
}
