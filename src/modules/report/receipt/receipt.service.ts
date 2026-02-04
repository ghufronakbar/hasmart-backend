import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BadRequestError, NotFoundError } from "../../../utils/error";
import { RecordActionModelType, RecordActionType } from ".prisma/client";
import { ReceiptData } from "./receipt.interface";
import { ReceiptParamsType } from "./receipt.validator";

export class ReceiptService extends BaseService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  getReceipt = async (data: ReceiptParamsType): Promise<ReceiptData> => {
    switch (data.type) {
      case "sales":
        return this.getSalesReceipt(data.receiptId);
      case "sell":
        return this.getSellReceipt(data.receiptId);
      default:
        throw new BadRequestError("Tipe transaksi tidak ditemukan");
    }
  };

  getSalesReceipt = async (receiptId: number): Promise<ReceiptData> => {
    const [receipt, track] = await Promise.all([
      this.prisma.transactionSales.findUnique({
        where: { id: receiptId },
        select: {
          deletedAt: true,
          invoiceNumber: true,
          recordedDiscountAmount: true,
          recordedSubTotalAmount: true,
          recordedTotalAmount: true,
          transactionDate: true,
          transactionSalesItems: {
            select: {
              recordedDiscountAmount: true,
              recordedSubTotalAmount: true,
              recordedTotalAmount: true,
              qty: true,
              masterItem: {
                select: {
                  name: true,
                },
              },
              masterItemVariant: {
                select: {
                  unit: true,
                },
              },
            },
          },
          branch: {
            select: {
              name: true,
              address: true,
              phone: true,
            },
          },
          masterMember: {
            select: {
              name: true,
              phone: true,
              masterMemberCategory: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.recordAction.findFirst({
        where: {
          modelId: receiptId,
          modelType: RecordActionModelType.TRANSACTION_SALES,
          actionType: RecordActionType.CREATE,
        },
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);
    if (!receipt || receipt.deletedAt) {
      throw new NotFoundError();
    }

    return {
      address: receipt.branch.address || "",
      cashierName: track?.user?.name || "",
      customerName: receipt.masterMember
        ? `${receipt.masterMember.name} (${receipt.masterMember.masterMemberCategory.name})`
        : "",
      invoiceNumber: receipt.invoiceNumber,
      phone: receipt.branch.phone || "",
      storeName: receipt.branch.name,
      items: receipt.transactionSalesItems.map((item) => ({
        name: item.masterItem.name,
        discount: item.recordedDiscountAmount.toString(),
        price: item.recordedSubTotalAmount.toString(),
        qty: item.qty,
        total: item.recordedTotalAmount.toString(),
        unit: item.masterItemVariant.unit,
      })),
      globalDiscount: receipt.recordedDiscountAmount.toString(),
      tax: "0",
      showTax: false,
      subTotal: receipt.recordedSubTotalAmount.toString(),
      totalAmount: receipt.recordedTotalAmount.toString(),
      // TODO: belum ada
      payAmount: "0",
      changeAmount: "0",
      transactionDate: receipt.transactionDate,
    };
  };

  getSellReceipt = async (receiptId: number): Promise<ReceiptData> => {
    const [receipt, track] = await Promise.all([
      this.prisma.transactionSell.findUnique({
        where: { id: receiptId },
        select: {
          deletedAt: true,
          invoiceNumber: true,
          recordedDiscountAmount: true,
          recordedSubTotalAmount: true,
          recordedTotalAmount: true,
          transactionDate: true,
          recordedTaxAmount: true,
          transactionSellItems: {
            select: {
              recordedDiscountAmount: true,
              recordedSubTotalAmount: true,
              recordedTotalAmount: true,
              qty: true,
              masterItem: {
                select: {
                  name: true,
                },
              },
              masterItemVariant: {
                select: {
                  unit: true,
                },
              },
            },
          },
          branch: {
            select: {
              name: true,
              address: true,
              phone: true,
            },
          },
          masterMember: {
            select: {
              name: true,
              phone: true,
              masterMemberCategory: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.recordAction.findFirst({
        where: {
          modelId: receiptId,
          modelType: RecordActionModelType.TRANSACTION_SELL,
          actionType: RecordActionType.CREATE,
        },
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);
    if (!receipt || receipt.deletedAt) {
      throw new NotFoundError();
    }

    return {
      address: receipt.branch.address || "",
      cashierName: track?.user?.name || "",
      customerName: receipt.masterMember
        ? `${receipt.masterMember.name} (${receipt.masterMember.masterMemberCategory.name})`
        : "",
      invoiceNumber: receipt.invoiceNumber,
      phone: receipt.branch.phone || "",
      storeName: receipt.branch.name,
      items: receipt.transactionSellItems.map((item) => ({
        name: item.masterItem.name,
        discount: item.recordedDiscountAmount.toString(),
        price: item.recordedSubTotalAmount.toString(),
        qty: item.qty,
        total: item.recordedTotalAmount.toString(),
        unit: item.masterItemVariant.unit,
      })),
      globalDiscount: receipt.recordedDiscountAmount.toString(),
      tax: receipt.recordedTaxAmount.toString(),
      showTax: true,
      subTotal: receipt.recordedSubTotalAmount.toString(),
      totalAmount: receipt.recordedTotalAmount.toString(),
      payAmount: receipt.recordedTotalAmount.toString(),
      // TODO: belum ada atau expected uang pas karena b2b
      changeAmount: "0",
      transactionDate: receipt.transactionDate,
    };
  };
}
