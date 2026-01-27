import { BranchController } from "./branch.controller";
import { asyncHandler } from "../../../middleware/error-handler";
import { validateHandler } from "../../../middleware/validate-handler";
import { BaseRouter } from "../../../base/base-router";
import { BranchBodySchema, BranchParamsSchema } from "./brach.validator";
import { useFilter } from "../../../middleware/use-filter";

export class BranchRouter extends BaseRouter {
  constructor(private controller: BranchController) {
    super();
    this.registerRoutes();
  }

  private registerRoutes() {
    this.router.get(
      "/",
      useFilter(),
      asyncHandler(
        async (req, res) => await this.controller.getAllBranches(req, res),
      ),
    );

    this.router.get(
      "/:branchId",
      validateHandler({ params: BranchParamsSchema }),
      asyncHandler(
        async (req, res) => await this.controller.getBranchById(req, res),
      ),
    );

    this.router.post(
      "/",
      validateHandler({ body: BranchBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.createBranch(req, res),
      ),
    );

    this.router.put(
      "/:branchId",
      validateHandler({ params: BranchParamsSchema, body: BranchBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.updateBranch(req, res),
      ),
    );
    this.router.delete(
      "/:branchId",
      validateHandler({ params: BranchParamsSchema }),
      asyncHandler(
        async (req, res) => await this.controller.deleteBranch(req, res),
      ),
    );
  }
}
