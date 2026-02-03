import { BaseController } from "../../../base/base-controller";
import { ItemService } from "./item.service";
import { Request, Response } from "express";
import {
  ItemBodyType,
  ItemUpdateBodyType,
  ItemParamsType,
  VariantBodyType,
  VariantParamsType,
  GetItemByCodeParamsType,
  ItemQueryType,
} from "./item.validator";

export class ItemController extends BaseController {
  constructor(private service: ItemService) {
    super();
  }

  getAllItems = async (req: Request, res: Response) => {
    const filter = req.filterQuery;
    const branchQuery = req.branchQuery;
    const itemQuery = req.query as unknown as ItemQueryType;
    const { rows, pagination } = await this.service.getAllItems(
      filter,
      branchQuery,
      itemQuery,
    );
    return this.sendList(req, res, rows, pagination, filter);
  };

  getItemById = async (req: Request, res: Response) => {
    const params = req.params as unknown as ItemParamsType;
    const branchQuery = req.branchQuery;
    const data = await this.service.getItemById(
      params.masterItemId,
      branchQuery,
    );
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

  getItemByCode = async (req: Request, res: Response) => {
    const params = req.params as unknown as GetItemByCodeParamsType;
    const result = await this.service.getItemByCode(params.code);
    return this.sendOk(req, res, result);
  };
}
