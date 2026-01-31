import { ItemController } from "./item.controller";
import { asyncHandler } from "../../../middleware/error-handler";
import { validateHandler } from "../../../middleware/validate-handler";
import { BaseRouter } from "../../../base/base-router";
import {
  ItemBodySchema,
  ItemUpdateBodySchema,
  ItemParamsSchema,
  VariantBodySchema,
  VariantParamsSchema,
} from "./item.validator";
import { useFilter } from "../../../middleware/use-filter";
import { useAuth } from "../../../middleware/use-auth";
import { JwtService } from "../../common/jwt/jwt.service";
import { useBranch } from "../../../middleware/use-branch";

export class ItemRouter extends BaseRouter {
  constructor(
    private controller: ItemController,
    private jwtService: JwtService,
  ) {
    super();
    this.registerRoutes();
  }

  private registerRoutes() {
    // GET /api/master/item (paginated, with optional branchId)
    this.router.get(
      "/",
      useAuth(this.jwtService),
      useFilter(["name"]),
      useBranch(),
      asyncHandler(
        async (req, res) => await this.controller.getAllItems(req, res),
      ),
    );

    // GET /api/master/item/:masterItemId
    this.router.get(
      "/:masterItemId",
      useAuth(this.jwtService),
      useBranch(),
      validateHandler({ params: ItemParamsSchema }),
      asyncHandler(
        async (req, res) => await this.controller.getItemById(req, res),
      ),
    );

    // POST /api/master/item
    this.router.post(
      "/",
      useAuth(this.jwtService),
      validateHandler({ body: ItemBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.createItem(req, res),
      ),
    );

    // PUT /api/master/item/:masterItemId
    this.router.put(
      "/:masterItemId",
      useAuth(this.jwtService),
      validateHandler({ params: ItemParamsSchema, body: ItemUpdateBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.updateItem(req, res),
      ),
    );

    // DELETE /api/master/item/:masterItemId
    this.router.delete(
      "/:masterItemId",
      useAuth(this.jwtService),
      validateHandler({ params: ItemParamsSchema }),
      asyncHandler(
        async (req, res) => await this.controller.deleteItem(req, res),
      ),
    );

    // === Variant Routes ===

    // POST /api/master/item/:masterItemId/variant
    this.router.post(
      "/:masterItemId/variant",
      useAuth(this.jwtService),
      validateHandler({ params: ItemParamsSchema, body: VariantBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.createVariant(req, res),
      ),
    );

    // PUT /api/master/item/:masterItemId/variant/:masterItemVariantId
    this.router.put(
      "/:masterItemId/variant/:masterItemVariantId",
      useAuth(this.jwtService),
      validateHandler({ params: VariantParamsSchema, body: VariantBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.updateVariant(req, res),
      ),
    );

    // DELETE /api/master/item/:masterItemId/variant/:masterItemVariantId
    this.router.delete(
      "/:masterItemId/variant/:masterItemVariantId",
      useAuth(this.jwtService),
      validateHandler({ params: VariantParamsSchema }),
      asyncHandler(
        async (req, res) => await this.controller.deleteVariant(req, res),
      ),
    );
  }
}
