import express from "express";

// Branch Module
import { BranchRouter } from "./modules/app/branch/branch.route";
import { BranchController } from "./modules/app/branch/branch.controller";
import { BranchService } from "./modules/app/branch/branch.service";

// User Module
import { UserRouter } from "./modules/app/user/user.route";
import { UserController } from "./modules/app/user/user.controller";
import { UserService } from "./modules/app/user/user.service";

// Item Category Module
import { ItemCategoryRouter } from "./modules/master/item-category/item-category.route";
import { ItemCategoryController } from "./modules/master/item-category/item-category.controller";
import { ItemCategoryService } from "./modules/master/item-category/item-category.service";

// Common Services
import { PrismaService } from "./modules/common/prisma/prisma.service";
import { PasswordService } from "./modules/common/password/password.service";
import { JwtService } from "./modules/common/jwt/jwt.service";

import { Config } from "./config";

const api = express.Router();

// init config
const cfg = new Config();

// init common services
const prismaService = new PrismaService();
const passwordService = new PasswordService();
const jwtService = new JwtService(cfg);

// init branch module
const branchService = new BranchService(prismaService);
const branchController = new BranchController(branchService);
const branchRouter = new BranchRouter(branchController);

// init user module
const userService = new UserService(prismaService, passwordService, jwtService);
const userController = new UserController(userService);
const userRouter = new UserRouter(userController, jwtService);

// init item-category module
const itemCategoryService = new ItemCategoryService(prismaService);
const itemCategoryController = new ItemCategoryController(itemCategoryService);
const itemCategoryRouter = new ItemCategoryRouter(
  itemCategoryController,
  jwtService,
);

// use routers
api.use("/app/branch", branchRouter.router);
api.use("/app/user", userRouter.router);
api.use("/master/item-category", itemCategoryRouter.router);

export default api;
