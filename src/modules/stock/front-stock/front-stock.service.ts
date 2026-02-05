import { BaseService, Pagination } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  FrontStockBodyType,
  FrontStockParamsType,
} from "./front-stock.validator";
import { BadRequestError, NotFoundError } from "../../../utils/error";
import { FilterQueryType } from "src/middleware/use-filter";
import { MasterItem, MasterItemVariant, Prisma, User } from ".prisma/client";
import { RefreshStockService } from "../../transaction/refresh-stock/refresh-stock.service";
import {
  FrontStockTransferResponse,
  ItemFrontStockResponse,
} from "./front-stock.interface";

export class FrontStockService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshStockService: RefreshStockService,
  ) {
    super();
  }

  private constructWhereItem(
    filter?: FilterQueryType,
  ): Prisma.MasterItemWhereInput {
    const where: Prisma.MasterItemWhereInput = {
      deletedAt: null,
      OR: filter?.search
        ? [
            { name: { contains: filter.search, mode: "insensitive" } },
            { code: { contains: filter.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    return where;
  }

  private constructArgsItem(
    branchId: number,
    filter?: FilterQueryType,
  ): Prisma.MasterItemFindManyArgs {
    const args: Prisma.MasterItemFindManyArgs = {
      where: this.constructWhereItem(filter),
      skip: filter?.skip,
      take: filter?.limit,
      orderBy: this.constructOrderItem(filter),
      select: {
        id: true,
        name: true,
        code: true,
        masterItemVariants: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            amount: "asc",
          },
        },
        itemBranches: {
          where: {
            branchId,
            deletedAt: null,
          },
          select: {
            id: true,
            recordedFrontStock: true,
          },
          take: 1,
        },
      },
    };

    return args;
  }

  private constructOrderItem(
    filter?: FilterQueryType,
  ): Prisma.MasterItemOrderByWithRelationInput | undefined {
    switch (filter?.sortBy) {
      case "frontStock":
      // TODO: implement logic
      default:
        return filter?.sortBy
          ? { [filter?.sortBy]: filter?.sort }
          : { id: "desc" };
    }
  }

  getAllItemWithFrontStock = async (
    params: FrontStockParamsType,
    filter?: FilterQueryType,
  ): Promise<{ rows: ItemFrontStockResponse[]; pagination: Pagination }> => {
    const [rows, count] = await Promise.all([
      this.prisma.masterItem.findMany(
        this.constructArgsItem(params.branchId, filter),
      ),
      this.prisma.masterItem.count({ where: this.constructWhereItem(filter) }),
    ]);

    const pagination = this.createPagination({
      total: count,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
    });

    const cRows = rows as unknown as (MasterItem & {
      itemBranches: { recordedFrontStock: number }[];
      masterItemVariants: MasterItemVariant[];
      user: User;
    })[];

    const data: ItemFrontStockResponse[] = cRows.map((item) => {
      return {
        id: item.id,
        name: item.name,
        code: item.code,
        frontStock: item.itemBranches?.[0]?.recordedFrontStock || 0,
        variants: item.masterItemVariants,
      };
    });

    return { rows: data, pagination };
  };

  private constructWhereFrontStockTransfer(
    filter?: FilterQueryType,
  ): Prisma.FrontStockTransferWhereInput {
    const where: Prisma.FrontStockTransferWhereInput = {
      deletedAt: null,
      OR: filter?.search
        ? [{ notes: { contains: filter.search, mode: "insensitive" } }]
        : undefined,
    };
    return where;
  }

  private constructArgsFrontStock(
    filter?: FilterQueryType,
  ): Prisma.FrontStockTransferFindManyArgs {
    const args: Prisma.FrontStockTransferFindManyArgs = {
      where: this.constructWhereFrontStockTransfer(filter),
      skip: filter?.skip,
      take: filter?.limit,
      orderBy: filter?.sortBy
        ? {
            [filter?.sortBy]: filter?.sort,
          }
        : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        frontStockTransferItems: {
          where: {
            deletedAt: null,
          },
          include: {
            masterItem: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            masterVariant: {
              select: {
                id: true,
                unit: true,
                amount: true,
              },
            },
          },
        },
      },
    };

    return args;
  }

  getAllFrontStockTransfers = async (
    params: FrontStockParamsType,
    filter?: FilterQueryType,
  ): Promise<{
    rows: FrontStockTransferResponse[];
    pagination: Pagination;
  }> => {
    const [rows, count] = await Promise.all([
      this.prisma.frontStockTransfer.findMany(
        this.constructArgsFrontStock(filter),
      ),
      this.prisma.frontStockTransfer.count({
        where: this.constructWhereFrontStockTransfer(filter),
      }),
    ]);

    const pagination = this.createPagination({
      total: count,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
    });

    // Map frontStockTransferItems to items to match interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedRows = rows.map((row: any) => ({
      ...row,
      items: row.frontStockTransferItems.map((item: any) => ({
        ...item,
        masterItemVariant: item.masterVariant,
      })),
      user: row.user,
    }));

    return {
      rows: mappedRows as FrontStockTransferResponse[],
      pagination,
    };
  };

  createFrontStock = async (data: FrontStockBodyType, userId: number) => {
    const uniqueVariantIds = new Set(
      data.items.map((item) => item.masterVariantId),
    );
    if (uniqueVariantIds.size !== data.items.length) {
      throw new BadRequestError("ID Variant harus unik");
    }
    const [branch, variants] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: data.branchId },
        select: {
          deletedAt: true,
        },
      }),
      this.prisma.masterItemVariant.findMany({
        where: {
          id: { in: data.items.map((item) => item.masterVariantId) },
          deletedAt: null,
        },
        select: {
          amount: true,
          masterItemId: true,
          id: true,
        },
      }),
    ]);
    if (!branch || branch.deletedAt) {
      throw new NotFoundError("Branch tidak ditemukan");
    }
    if (variants.length !== data.items.length) {
      throw new NotFoundError("Variant tidak ditemukan");
    }
    const frontStock = await this.prisma.frontStockTransfer.create({
      data: {
        branchId: data.branchId,
        notes: data.notes,
        userId,
        frontStockTransferItems: {
          create: data.items.map((item) => {
            const variant = variants.find((v) => v.id === item.masterVariantId);
            if (!variant) {
              throw new NotFoundError("Variant tidak ditemukan");
            }
            return {
              masterVariantId: item.masterVariantId,
              masterItemId: variant.masterItemId,
              recordedConversion: variant.amount,
              amount: item.transferAmount,
              totalAmount: item.transferAmount * variant.amount,
            };
          }),
        },
      },
    });

    // refresh front stock
    await Promise.all(
      variants.map((variant) =>
        this.refreshStockService.refreshFrontStock(
          data.branchId,
          variant.masterItemId,
        ),
      ),
    );
    return frontStock;
  };

  deleteFrontStock = async (id: number) => {
    const data = await this.prisma.frontStockTransfer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!data) {
      throw new NotFoundError();
    }
    const deleted = await this.prisma.frontStockTransfer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        frontStockTransferItems: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: new Date() },
          },
        },
      },
      select: {
        frontStockTransferItems: {
          select: {
            masterItemId: true,
          },
        },
      },
    });

    // refresh front stock
    await Promise.all(
      deleted.frontStockTransferItems.map((variant) =>
        this.refreshStockService.refreshFrontStock(
          data.branchId,
          variant.masterItemId,
        ),
      ),
    );
    return deleted;
  };
}
