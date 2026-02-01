import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  ItemBodyType,
  ItemUpdateBodyType,
  VariantBodyType,
} from "./item.validator";
import {
  ItemListResponse,
  ItemResponse,
  MasterItemWithIncludes,
} from "./item.interface";
import { BadRequestError, NotFoundError } from "../../../utils/error";
import { FilterQueryType } from "src/middleware/use-filter";
import { Prisma } from ".prisma/client";
import { BranchQueryType } from "src/middleware/use-branch";

export class ItemService extends BaseService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  getVariantByCode = async (code: string) => {
    const variant = await this.prisma.masterItemVariant.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        deletedAt: null,
      },
      include: {
        masterItem: {
          include: {
            masterItemVariants: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundError();
    }

    return variant;
  };

  private constructWhere(
    filter?: FilterQueryType,
    idNotIns?: number[],
  ): Prisma.MasterItemWhereInput {
    const where: Prisma.MasterItemWhereInput = {
      deletedAt: null,
      id:
        Array.isArray(idNotIns) && idNotIns.length > 0
          ? { notIn: idNotIns }
          : undefined,
      OR: filter?.search
        ? [
            { name: { contains: filter.search, mode: "insensitive" } },
            {
              masterItemVariants: {
                some: {
                  code: { contains: filter.search, mode: "insensitive" },
                },
              },
            },
          ]
        : undefined,
    };
    return where;
  }

  private constructArgs(
    filter?: FilterQueryType,
    idNotIns?: number[],
  ): Prisma.MasterItemFindManyArgs {
    const args: Prisma.MasterItemFindManyArgs = {
      where: this.constructWhere(filter, idNotIns),
      skip: filter?.skip,
      take: filter?.limit,
      orderBy: filter?.sortBy
        ? {
            [filter?.sortBy]: filter?.sort,
          }
        : undefined,
      include: {
        masterItemCategory: {
          select: { id: true, code: true, name: true },
        },
        masterSupplier: {
          select: { id: true, code: true, name: true },
        },
        masterItemVariants: {
          where: { deletedAt: null },
          orderBy: { isBaseUnit: "desc" },
        },
        itemBranches: {
          where: { deletedAt: null },
          select: { branchId: true, recordedStock: true },
        },
      },
    };

    return args;
  }

  private mapToListResponse(
    item: MasterItemWithIncludes,
    branchId?: number,
  ): ItemListResponse {
    let stock = 0;

    if (branchId) {
      const branchStock = item.itemBranches.find(
        (ib) => ib.branchId === branchId,
      );
      stock = branchStock?.recordedStock ?? 0;
    } else {
      stock = item.itemBranches.reduce(
        (total, variant) => total + variant.recordedStock,
        0,
      );
    }

    return {
      id: item.id,
      name: item.name,
      masterItemCategoryId: item.masterItemCategoryId,
      masterSupplierId: item.masterSupplierId,
      isActive: item.isActive,
      recordedBuyPrice: item.recordedBuyPrice,
      stock,
      masterItemCategory: item.masterItemCategory,
      masterSupplier: item.masterSupplier,
      masterItemVariants: item.masterItemVariants.map((v) => ({
        id: v.id,
        code: v.code,
        unit: v.unit,
        amount: v.amount,
        recordedBuyPrice: v.recordedBuyPrice,
        recordedProfitPercentage: v.recordedProfitPercentage,
        recordedProfitAmount: v.recordedProfitAmount,
        sellPrice: v.sellPrice,
        isBaseUnit: v.isBaseUnit,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  getAllItems = async (
    filter?: FilterQueryType,
    branchQuery?: BranchQueryType,
    idNotIns?: number[],
  ) => {
    const [rows, count] = await Promise.all([
      this.prisma.masterItem.findMany(this.constructArgs(filter, idNotIns)),
      this.prisma.masterItem.count({
        where: this.constructWhere(filter, idNotIns),
      }),
    ]);

    const mappedRows = (rows as unknown as MasterItemWithIncludes[]).map(
      (item) => this.mapToListResponse(item, branchQuery?.branchId),
    );

    const pagination = this.createPagination({
      total: count,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
    });
    return { rows: mappedRows, pagination };
  };

  getItemById = async (
    id: number,
    branchQuery?: BranchQueryType,
  ): Promise<ItemResponse> => {
    const item = await this.prisma.masterItem.findFirst({
      where: { id, deletedAt: null },
      include: {
        masterItemCategory: {
          select: { id: true, code: true, name: true },
        },
        masterSupplier: {
          select: { id: true, code: true, name: true },
        },
        masterItemVariants: {
          where: { deletedAt: null },
          orderBy: { isBaseUnit: "desc" },
        },
        itemBranches: {
          where: { deletedAt: null },
          select: { branchId: true, recordedStock: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundError();
    }

    return this.mapToListResponse(
      item as unknown as MasterItemWithIncludes,
      branchQuery?.branchId,
    ) as ItemResponse;
  };

  createItem = async (data: ItemBodyType) => {
    // Validate supplier exists
    const supplier = await this.prisma.masterSupplier.findFirst({
      where: { id: data.masterSupplierId, deletedAt: null },
    });
    if (!supplier) {
      throw new BadRequestError("Supplier tidak ditemukan");
    }

    // Validate category exists
    const category = await this.prisma.masterItemCategory.findFirst({
      where: { id: data.masterItemCategoryId, deletedAt: null },
    });
    if (!category) {
      throw new BadRequestError("Kategori tidak ditemukan");
    }

    // Check for duplicate variant codes and handle restore
    const variantCodes = data.masterItemVariants.map((v) =>
      v.code.toUpperCase(),
    );
    const existingVariants = await this.prisma.masterItemVariant.findMany({
      where: { code: { in: variantCodes } },
    });
    const existingVariantCodes = existingVariants.map((v) => v.code);

    for (const existing of existingVariants) {
      if (existing.deletedAt === null) {
        throw new BadRequestError(
          `Kode variant "${existing.code}" sudah digunakan`,
        );
      }
    }

    let itemId = 0;

    await this.prisma.$transaction(async (tx) => {
      const item = await this.prisma.masterItem.create({
        data: {
          name: data.name,
          masterSupplierId: data.masterSupplierId,
          masterItemCategoryId: data.masterItemCategoryId,
          isActive: data.isActive,
          recordedBuyPrice: 0,
          masterItemVariants: {
            create: data.masterItemVariants
              .filter(
                (v) => !existingVariantCodes.includes(v.code.toUpperCase()),
              )
              .map((v) => ({
                code: v.code.toUpperCase(),
                unit: v.unit,
                amount: v.amount,
                sellPrice: v.sellPrice,
                isBaseUnit: v.isBaseUnit,
                recordedBuyPrice: 0,
                recordedProfitPercentage: 0,
                recordedProfitAmount: 0,
              })),
          },
        },
        include: {
          masterItemCategory: {
            select: { id: true, code: true, name: true },
          },
          masterSupplier: {
            select: { id: true, code: true, name: true },
          },
          masterItemVariants: {
            where: { deletedAt: null },
          },
        },
      });
      itemId = item.id;
      for (const existing of existingVariants) {
        if (existing.deletedAt !== null) {
          const newVariant = data.masterItemVariants.find(
            (v) => v.code.toUpperCase() === existing.code,
          );
          if (newVariant) {
            await this.prisma.masterItemVariant.update({
              where: { id: existing.id },
              data: {
                masterItemId: item.id,
                unit: newVariant.unit,
                amount: newVariant.amount,
                sellPrice: newVariant.sellPrice,
                isBaseUnit: newVariant.isBaseUnit,
                deletedAt: null,
              },
            });
          }
        }
      }
    });
    return this.getItemById(itemId);
  };

  updateItem = async (id: number, data: ItemUpdateBodyType) => {
    const item = await this.prisma.masterItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundError();
    }

    // Validate supplier exists
    const supplier = await this.prisma.masterSupplier.findFirst({
      where: { id: data.masterSupplierId, deletedAt: null },
    });
    if (!supplier) {
      throw new BadRequestError("Supplier tidak ditemukan");
    }

    // Validate category exists
    const category = await this.prisma.masterItemCategory.findFirst({
      where: { id: data.masterItemCategoryId, deletedAt: null },
    });
    if (!category) {
      throw new BadRequestError("Kategori tidak ditemukan");
    }

    await this.prisma.masterItem.update({
      where: { id },
      data: {
        name: data.name,
        masterSupplierId: data.masterSupplierId,
        masterItemCategoryId: data.masterItemCategoryId,
        isActive: data.isActive,
      },
    });

    return this.getItemById(id);
  };

  deleteItem = async (id: number) => {
    const item = await this.prisma.masterItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundError();
    }

    return await this.prisma.masterItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        masterItemVariants: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: new Date() },
          },
        },
      },
    });
  };

  // Variant methods
  createVariant = async (masterItemId: number, data: VariantBodyType) => {
    const item = await this.prisma.masterItem.findFirst({
      where: { id: masterItemId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundError();
    }

    const upperCode = data.code.toUpperCase();

    // Check if code exists
    const existing = await this.prisma.masterItemVariant.findFirst({
      where: { code: upperCode },
    });

    if (existing) {
      if (existing.deletedAt === null) {
        throw new BadRequestError("Kode variant sudah digunakan");
      } else {
        // Restore
        return await this.prisma.masterItemVariant.update({
          where: { id: existing.id },
          data: {
            masterItemId,
            unit: data.unit,
            amount: data.amount,
            sellPrice: data.sellPrice,
            isBaseUnit: data.isBaseUnit,
            deletedAt: null,
          },
        });
      }
    }

    return await this.prisma.masterItemVariant.create({
      data: {
        masterItemId,
        code: upperCode,
        unit: data.unit,
        amount: data.amount,
        sellPrice: data.sellPrice,
        isBaseUnit: data.isBaseUnit,
        recordedBuyPrice: 0,
        recordedProfitPercentage: 0,
        recordedProfitAmount: 0,
      },
    });
  };

  updateVariant = async (
    masterItemId: number,
    variantId: number,
    data: VariantBodyType,
  ) => {
    const variant = await this.prisma.masterItemVariant.findFirst({
      where: { id: variantId, masterItemId, deletedAt: null },
    });
    if (!variant) {
      throw new NotFoundError();
    }

    const upperCode = data.code.toUpperCase();

    // Check if code is used by another variant
    const codeCheck = await this.prisma.masterItemVariant.findFirst({
      where: {
        code: upperCode,
        deletedAt: null,
        NOT: { id: variantId },
      },
    });
    if (codeCheck) {
      throw new BadRequestError("Kode variant sudah digunakan");
    }

    return await this.prisma.masterItemVariant.update({
      where: { id: variantId },
      data: {
        code: upperCode,
        unit: data.unit,
        amount: data.amount,
        sellPrice: data.sellPrice,
        isBaseUnit: data.isBaseUnit,
      },
    });
  };

  deleteVariant = async (masterItemId: number, variantId: number) => {
    const variant = await this.prisma.masterItemVariant.findFirst({
      where: { id: variantId, masterItemId, deletedAt: null },
    });
    if (!variant) {
      throw new NotFoundError();
    }

    // Check if it's the last variant
    const variantCount = await this.prisma.masterItemVariant.count({
      where: { masterItemId, deletedAt: null },
    });
    if (variantCount <= 1) {
      throw new BadRequestError("Item harus memiliki minimal 1 variant");
    }

    return await this.prisma.masterItemVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date() },
    });
  };
}
