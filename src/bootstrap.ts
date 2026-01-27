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

// Item Module
import { ItemRouter } from "./modules/master/item/item.route";
import { ItemController } from "./modules/master/item/item.controller";
import { ItemService } from "./modules/master/item/item.service";

// Supplier Module
import { SupplierRouter } from "./modules/master/supplier/supplier.route";
import { SupplierController } from "./modules/master/supplier/supplier.controller";
import { SupplierService } from "./modules/master/supplier/supplier.service";

// Unit Module
import { UnitRouter } from "./modules/master/unit/unit.route";
import { UnitController } from "./modules/master/unit/unit.controller";
import { UnitService } from "./modules/master/unit/unit.service";

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
const branchRouter = new BranchRouter(branchController, jwtService);

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

// init item module
const itemService = new ItemService(prismaService);
const itemController = new ItemController(itemService);
const itemRouter = new ItemRouter(itemController, jwtService);

// init supplier module
const supplierService = new SupplierService(prismaService);
const supplierController = new SupplierController(supplierService);
const supplierRouter = new SupplierRouter(supplierController, jwtService);

// init unit module
const unitService = new UnitService(prismaService);
const unitController = new UnitController(unitService);
const unitRouter = new UnitRouter(unitController, jwtService);

// use routers
api.use("/app/branch", branchRouter.router);
api.use("/app/user", userRouter.router);
api.use("/master/item-category", itemCategoryRouter.router);
api.use("/master/item", itemRouter.router);
api.use("/master/supplier", supplierRouter.router);
api.use("/master/unit", unitRouter.router);

export default api;
