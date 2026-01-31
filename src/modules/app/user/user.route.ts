import { UserController } from "./user.controller";
import { asyncHandler } from "../../../middleware/error-handler";
import { validateHandler } from "../../../middleware/validate-handler";
import { BaseRouter } from "../../../base/base-router";
import {
  FirstTimeSetupBodySchema,
  LoginBodySchema,
  CreateUserBodySchema,
} from "./user.validator";
import { useAuth } from "../../../middleware/use-auth";
import { JwtService } from "../../common/jwt/jwt.service";

export class UserRouter extends BaseRouter {
  constructor(
    private controller: UserController,
    private jwtService: JwtService,
  ) {
    super();
    this.registerRoutes();
  }

  private registerRoutes() {
    // GET /api/app/user/status
    this.router.get(
      "/status",
      asyncHandler(
        async (req, res) => await this.controller.getStatus(req, res),
      ),
    );

    // POST /api/app/user/first-time-setup
    this.router.post(
      "/first-time-setup",
      validateHandler({ body: FirstTimeSetupBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.firstTimeSetup(req, res),
      ),
    );

    // POST /api/app/user/login
    this.router.post(
      "/login",
      validateHandler({ body: LoginBodySchema }),
      asyncHandler(async (req, res) => await this.controller.login(req, res)),
    );

    // POST /api/app/user (Bearer Token Required)
    this.router.post(
      "/",
      useAuth(this.jwtService),
      validateHandler({ body: CreateUserBodySchema }),
      asyncHandler(
        async (req, res) => await this.controller.createUser(req, res),
      ),
    );

    // GET /api/app/user/whoami (Bearer Token Required)
    this.router.get(
      "/whoami",
      useAuth(this.jwtService),
      asyncHandler(async (req, res) => await this.controller.whoami(req, res)),
    );
  }
}
