import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BadRequestError, NotFoundError } from "../../../utils/error";
import {
  RecordActionModelType,
  RecordActionType,
  SalesPaymentType,
} from ".prisma/client";
import { ReceiptData, SalesReceipt } from "./receipt.interface";
import { ReceiptParamsType, SalesReceiptQueryType } from "./receipt.validator";
import { Decimal } from "@prisma/client/runtime/library";

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
          cashReceived: true,
          cashChange: true,
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
      payAmount: receipt.cashReceived.toString(),
      changeAmount: receipt.cashChange.toString(),
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
      // NOTE: expected uang pas karena b2b
      changeAmount: "0",
      transactionDate: receipt.transactionDate,
    };
  };

  getSalesReceiptByDate = async (
    params: SalesReceiptQueryType,
    userId: number,
  ): Promise<SalesReceipt> => {
    // 1. Get Branch
    const branch = await this.prisma.branch.findFirst({
      where: { id: params.branchId },
    });
    if (!branch) throw new NotFoundError("Cabang tidak ditemukan");

    // 2. Get User/Cashier
    const cashier = await this.prisma.user.findFirst({
      where: { id: userId },
    });
    if (!cashier) throw new NotFoundError("User tidak ditemukan");

    // 3. Define Date Range (Full Day)
    const startDate = new Date(params.date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // 4. Fetch RecordActions to identify Sales created by this user today
    const actions = await this.prisma.recordAction.findMany({
      where: {
        userId: userId,
        modelType: RecordActionModelType.TRANSACTION_SALES,
        actionType: RecordActionType.CREATE,
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: { modelId: true },
    });

    const transactionIds = actions.map((a) => a.modelId);

    // 5. Fetch Sales Transactions
    const transactions = await this.prisma.transactionSales.findMany({
      where: {
        id: { in: transactionIds },
        branchId: params.branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        recordedTotalAmount: true,
        cashReceived: true,
        cashChange: true,
        paymentType: true,
      },
    });

    // 6. Aggregate Data
    let totalTransaction = 0;
    let totalAmount = new Decimal(0);
    const paymentTypeSummary: Record<SalesPaymentType, Decimal> = {
      CASH: new Decimal(0),
      DEBIT: new Decimal(0),
      QRIS: new Decimal(0),
    };

    transactions.forEach((t) => {
      totalTransaction++;
      const amount = t.recordedTotalAmount;

      totalAmount = totalAmount.add(amount);

      // Payment Type Breakdown
      const type = t.paymentType || SalesPaymentType.CASH;
      if (!paymentTypeSummary[type]) {
        paymentTypeSummary[type] = new Decimal(0);
      }
      paymentTypeSummary[type] = paymentTypeSummary[type].add(amount);
    });

    const cashIncome = paymentTypeSummary[SalesPaymentType.CASH];

    // Calculate total return (Placeholder for now)
    const totalReturn = new Decimal(0);

    // Balance
    const balance = cashIncome.sub(totalReturn);

    return {
      branch,
      date: startDate,
      cashierName: cashier.name,
      totalTransaction,
      totalAmount: totalAmount.toString(),
      totalReturn: totalReturn.toString(),
      paymentType: {
        CASH: paymentTypeSummary.CASH.toString(),
        DEBIT: paymentTypeSummary.DEBIT.toString(),
        QRIS: paymentTypeSummary.QRIS.toString(),
      },
      cashIncome: cashIncome.toString(),
      balance: balance.toString(),
    };
  };
}
