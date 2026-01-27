import { BaseController } from "../../../base/base-controller";
import { ItemService } from "./item.service";
import { Request, Response } from "express";
import {
  ItemBodyType,
  ItemUpdateBodyType,
  ItemParamsType,
  ItemQueryType,
  VariantBodyType,
  VariantParamsType,
} from "./item.validator";

export class ItemController extends BaseController {
  constructor(private service: ItemService) {
    super();
  }

  getAllItems = async (req: Request, res: Response) => {
    const filter = req.filterQuery;
    const query: ItemQueryType = {
      branchId: req.query.branchId
        ? parseInt(req.query.branchId as string)
        : undefined,
    };
    const { rows, pagination } = await this.service.getAllItems(filter, query);
    return this.sendList(req, res, rows, pagination, filter);
  };

  getItemById = async (req: Request, res: Response) => {
    const params = req.params as unknown as ItemParamsType;
    const query: ItemQueryType = {
      branchId: req.query.branchId
        ? parseInt(req.query.branchId as string)
        : undefined,
    };
    const data = await this.service.getItemById(params.masterItemId, query);
    return this.sendOk(req, res, data);
  };

  createItem = async (req: Request, res: Response) => {
    const data = req.body as ItemBodyType;
    const result = await this.service.createItem(data);
    return this.sendOk(req, res, result);
  };

  updateItem = async (req: Request, res: Response) => {
    const params = req.params as unknown as ItemParamsType;
    const data = req.body as ItemUpdateBodyType;
    const result = await this.service.updateItem(params.masterItemId, data);
    return this.sendOk(req, res, result);
  };

  deleteItem = async (req: Request, res: Response) => {
    const params = req.params as unknown as ItemParamsType;
    const result = await this.service.deleteItem(params.masterItemId);
    return this.sendOk(req, res, result);
  };

  // Variant methods
  createVariant = async (req: Request, res: Response) => {
    const params = req.params as unknown as ItemParamsType;
    const data = req.body as VariantBodyType;
    const result = await this.service.createVariant(params.masterItemId, data);
    return this.sendOk(req, res, result);
  };

  updateVariant = async (req: Request, res: Response) => {
    const params = req.params as unknown as VariantParamsType;
    const data = req.body as VariantBodyType;
    const result = await this.service.updateVariant(
      params.masterItemId,
      params.masterItemVariantId,
      data,
    );
    return this.sendOk(req, res, result);
  };

  deleteVariant = async (req: Request, res: Response) => {
    const params = req.params as unknown as VariantParamsType;
    const result = await this.service.deleteVariant(
      params.masterItemId,
      params.masterItemVariantId,
    );
    return this.sendOk(req, res, result);
  };
}
