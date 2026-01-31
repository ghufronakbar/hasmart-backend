import { BaseController } from "../../../base/base-controller";
import { UserService } from "./user.service";
import { Request, Response } from "express";
import {
  FirstTimeSetupBodyType,
  LoginBodyType,
  CreateUserBodyType,
} from "./user.validator";

export class UserController extends BaseController {
  constructor(private service: UserService) {
    super();
  }

  getStatus = async (req: Request, res: Response) => {
    const status = await this.service.getStatus();
    return this.sendOk(req, res, status);
  };

  firstTimeSetup = async (req: Request, res: Response) => {
    const data = req.body as FirstTimeSetupBodyType;
    const result = await this.service.firstTimeSetup(data);
    return this.sendOk(req, res, result);
  };

  login = async (req: Request, res: Response) => {
    const data = req.body as LoginBodyType;
    const result = await this.service.login(data);
    return this.sendOk(req, res, result);
  };

  createUser = async (req: Request, res: Response) => {
    const data = req.body as CreateUserBodyType;
    const result = await this.service.createUser(data);
    return this.sendOk(req, res, result);
  };

  whoami = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.service.whoami(userId);
    return this.sendOk(req, res, result);
  };
}
