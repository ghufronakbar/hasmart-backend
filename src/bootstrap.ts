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

// Member Category Module
import { MemberCategoryRouter } from "./modules/master/member-category/member-category.route";
import { MemberCategoryController } from "./modules/master/member-category/member-category.controller";
import { MemberCategoryService } from "./modules/master/member-category/member-category.service";

// Member Module
import { MemberRouter } from "./modules/master/member/member.route";
import { MemberController } from "./modules/master/member/member.controller";
import { MemberService } from "./modules/master/member/member.service";

// Transaction Common Services
import { RefreshStockService } from "./modules/transaction/refresh-stock/refresh-stock.service";

// Purchase Module
import { PurchaseRouter } from "./modules/transaction/purchase/purchase.route";
import { PurchaseController } from "./modules/transaction/purchase/purchase.controller";
import { PurchaseService } from "./modules/transaction/purchase/purchase.service";

// Purchase Return Module
import { PurchaseReturnRouter } from "./modules/transaction/purchase-return/purchase-return.route";
import { PurchaseReturnController } from "./modules/transaction/purchase-return/purchase-return.controller";
import { PurchaseReturnService } from "./modules/transaction/purchase-return/purchase-return.service";

// Sales Module
import { SalesRouter } from "./modules/transaction/sales/sales.route";
import { SalesController } from "./modules/transaction/sales/sales.controller";
import { SalesService } from "./modules/transaction/sales/sales.service";

// Sales Return Module
import { SalesReturnRouter } from "./modules/transaction/sales-return/sales-return.route";
import { SalesReturnController } from "./modules/transaction/sales-return/sales-return.controller";
import { SalesReturnService } from "./modules/transaction/sales-return/sales-return.service";

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

// init transaction common services
const refreshStockService = new RefreshStockService(prismaService);

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

// init member-category module
const memberCategoryService = new MemberCategoryService(prismaService);
const memberCategoryController = new MemberCategoryController(
  memberCategoryService,
);
const memberCategoryRouter = new MemberCategoryRouter(
  memberCategoryController,
  jwtService,
);

// init member module
const memberService = new MemberService(prismaService);
const memberController = new MemberController(memberService);
const memberRouter = new MemberRouter(memberController, jwtService);

// init purchase module
const purchaseService = new PurchaseService(prismaService, refreshStockService);
const purchaseController = new PurchaseController(purchaseService);
const purchaseRouter = new PurchaseRouter(purchaseController, jwtService);

// init purchase-return module
const purchaseReturnService = new PurchaseReturnService(
  prismaService,
  refreshStockService,
);
const purchaseReturnController = new PurchaseReturnController(
  purchaseReturnService,
);
const purchaseReturnRouter = new PurchaseReturnRouter(
  purchaseReturnController,
  jwtService,
);

// init sales module
const salesService = new SalesService(prismaService, refreshStockService);
const salesController = new SalesController(salesService);
const salesRouter = new SalesRouter(salesController, jwtService);

// init sales-return module
const salesReturnService = new SalesReturnService(
  prismaService,
  refreshStockService,
);
const salesReturnController = new SalesReturnController(salesReturnService);
const salesReturnRouter = new SalesReturnRouter(
  salesReturnController,
  jwtService,
);

// use routers
api.use("/app/branch", branchRouter.router);
api.use("/app/user", userRouter.router);
api.use("/master/item-category", itemCategoryRouter.router);
api.use("/master/item", itemRouter.router);
api.use("/master/supplier", supplierRouter.router);
api.use("/master/unit", unitRouter.router);
api.use("/master/member-category", memberCategoryRouter.router);
api.use("/master/member", memberRouter.router);
api.use("/transaction/purchase", purchaseRouter.router);
api.use("/transaction/purchase-return", purchaseReturnRouter.router);
api.use("/transaction/sales", salesRouter.router);
api.use("/transaction/sales-return", salesReturnRouter.router);

export default api;
