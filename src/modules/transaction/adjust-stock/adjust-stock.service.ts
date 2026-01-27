import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RefreshStockService } from "../refresh-stock/refresh-stock.service";
import {
  AdjustmentBodyType,
  AdjustmentItemType,
} from "./adjust-stock.validator";
import { BadRequestError, NotFoundError } from "../../../utils/error";
import { FilterQueryType } from "src/middleware/use-filter";
import {
  Prisma,
  RecordActionModelType,
  RecordActionType,
} from ".prisma/client";

interface CalculatedAdjustment {
  masterItemId: number;
  masterItemVariantId: number;
  gapAmount: number;
  recordedGapConversion: number;
  totalGapAmount: number;
}

export class AdjustStockService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshStockService: RefreshStockService,
  ) {
    super();
  }

  private constructWhere(
    filter?: FilterQueryType,
  ): Prisma.TransactionAdjustmentWhereInput {
    const where: Prisma.TransactionAdjustmentWhereInput = {
      deletedAt: null,
      OR: filter?.search
        ? [{ notes: { contains: filter.search, mode: "insensitive" } }]
        : undefined,
    };
    return where;
  }

  private constructArgs(
    filter?: FilterQueryType,
  ): Prisma.TransactionAdjustmentFindManyArgs {
    const args: Prisma.TransactionAdjustmentFindManyArgs = {
      where: this.constructWhere(filter),
      skip: filter?.skip,
      take: filter?.limit,
      orderBy: filter?.sortBy
        ? { [filter?.sortBy]: filter?.sort }
        : { createdAt: "desc" },
      include: {
        branch: { select: { id: true, name: true } },
        masterItem: { select: { id: true, name: true } },
        masterItemVariant: { select: { id: true, code: true, unit: true } },
      },
    };
    return args;
  }

  getAllAdjustments = async (filter?: FilterQueryType) => {
    const [rows, count] = await Promise.all([
      this.prisma.transactionAdjustment.findMany(this.constructArgs(filter)),
      this.prisma.transactionAdjustment.count({
        where: this.constructWhere(filter),
      }),
    ]);

    const pagination = this.createPagination({
      total: count,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
    });
    return { rows, pagination };
  };

  getAdjustmentById = async (id: number) => {
    const data = await this.prisma.transactionAdjustment.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        masterItem: { select: { id: true, name: true } },
        masterItemVariant: {
          select: { id: true, code: true, unit: true, amount: true },
        },
      },
    });
    if (!data) {
      throw new NotFoundError();
    }
    return data;
  };

  private async validateAndPrepare(data: AdjustmentBodyType) {
    // Validate unique variant IDs
    const variantIds = data.items.map((item) => item.masterItemVariantId);
    const uniqueVariantIds = [...new Set(variantIds)];
    if (variantIds.length !== uniqueVariantIds.length) {
      throw new BadRequestError("Setiap item variant harus unique");
    }

    // Validate branch exists
    const branch = await this.prisma.branch.findFirst({
      where: { id: data.branchId, deletedAt: null },
    });
    if (!branch) {
      throw new BadRequestError("Cabang tidak ditemukan");
    }

    // Validate all variants exist and get conversion
    const variants = await this.prisma.masterItemVariant.findMany({
      where: { id: { in: uniqueVariantIds }, deletedAt: null },
      select: { id: true, masterItemId: true, amount: true },
    });

    if (variants.length !== uniqueVariantIds.length) {
      throw new BadRequestError("Beberapa variant tidak ditemukan");
    }

    // Create variant map for quick lookup
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Validate masterItemId matches variant
    for (const item of data.items) {
      const variant = variantMap.get(item.masterItemVariantId);
      if (!variant || variant.masterItemId !== item.masterItemId) {
        throw new BadRequestError(
          "masterItemId tidak sesuai dengan variant yang dipilih",
        );
      }
    }

    // Get current stock for all items
    const itemIds = [...new Set(data.items.map((i) => i.masterItemId))];
    const currentStocks = await this.prisma.itemBranch.findMany({
      where: {
        branchId: data.branchId,
        masterItemId: { in: itemIds },
      },
      select: { masterItemId: true, recordedStock: true },
    });

    // Create stock map (default to 0 if not found)
    const stockMap = new Map(
      currentStocks.map((s) => [s.masterItemId, s.recordedStock]),
    );

    return { variantMap, stockMap };
  }

  private calculateAdjustments(
    items: AdjustmentItemType[],
    variantMap: Map<
      number,
      { id: number; masterItemId: number; amount: number }
    >,
    stockMap: Map<number, number>,
  ): CalculatedAdjustment[] {
    const adjustments: CalculatedAdjustment[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.masterItemVariantId)!;
      const recordedGapConversion = variant.amount;

      // Calculate target stock (in base unit)
      const targetStock = item.actualQty * recordedGapConversion;

      // Get current stock (default to 0 if not found)
      const currentStock = stockMap.get(item.masterItemId) || 0;

      // Calculate gap
      const totalGapAmount = targetStock - currentStock;

      // Skip if no gap (stock matches)
      if (totalGapAmount === 0) {
        continue;
      }

      // Calculate gap in variant unit (integer division)
      const gapAmount = Math.floor(totalGapAmount / recordedGapConversion);

      adjustments.push({
        masterItemId: item.masterItemId,
        masterItemVariantId: item.masterItemVariantId,
        gapAmount,
        recordedGapConversion,
        totalGapAmount,
      });
    }

    return adjustments;
  }

  createAdjustment = async (data: AdjustmentBodyType, userId: number) => {
    const { variantMap, stockMap } = await this.validateAndPrepare(data);
    const calculatedAdjustments = this.calculateAdjustments(
      data.items,
      variantMap,
      stockMap,
    );

    // If no adjustments needed (all stock matches), return early
    if (calculatedAdjustments.length === 0) {
      throw new BadRequestError(
        "Tidak ada penyesuaian yang diperlukan. Semua stok sudah sesuai dengan jumlah fisik.",
      );
    }

    // Create adjustments in transaction
    const createdAdjustments = await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        calculatedAdjustments.map((adj) =>
          tx.transactionAdjustment.create({
            data: {
              branchId: data.branchId,
              notes: data.notes || "",
              masterItemId: adj.masterItemId,
              masterItemVariantId: adj.masterItemVariantId,
              gapAmount: adj.gapAmount,
              recordedGapConversion: adj.recordedGapConversion,
              totalGapAmount: adj.totalGapAmount,
            },
          }),
        ),
      );

      // Record action for each adjustment
      await Promise.all(
        created.map((adj) =>
          tx.recordAction.create({
            data: {
              modelType: RecordActionModelType.TRANSACTION_ADJUSTMENT,
              modelId: adj.id,
              actionType: RecordActionType.CREATE,
              payloadBefore: Prisma.DbNull,
              payloadAfter: adj as unknown as Prisma.JsonObject,
              userId,
            },
          }),
        ),
      );

      return created;
    });

    // Refresh stock for all adjusted items
    const uniqueItemIds = [
      ...new Set(calculatedAdjustments.map((a) => a.masterItemId)),
    ];
    await Promise.all(
      uniqueItemIds.map((itemId) =>
        this.refreshStockService.refreshRealStock(data.branchId, itemId),
      ),
    );

    // Return all created adjustments
    return Promise.all(
      createdAdjustments.map((adj) => this.getAdjustmentById(adj.id)),
    );
  };

  deleteAdjustment = async (id: number, userId: number) => {
    const existing = await this.prisma.transactionAdjustment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError();
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      // Soft delete the adjustment
      const result = await tx.transactionAdjustment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Record action
      await tx.recordAction.create({
        data: {
          modelType: RecordActionModelType.TRANSACTION_ADJUSTMENT,
          modelId: id,
          actionType: RecordActionType.DELETE,
          payloadBefore: existing as unknown as Prisma.JsonObject,
          payloadAfter: Prisma.DbNull,
          userId,
        },
      });

      return result;
    });

    // Refresh stock
    await this.refreshStockService.refreshRealStock(
      existing.branchId,
      existing.masterItemId,
    );

    return deleted;
  };
}
