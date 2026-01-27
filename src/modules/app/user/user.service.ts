import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PasswordService } from "../../common/password/password.service";
import { JwtService } from "../../common/jwt/jwt.service";
import {
  FirstTimeSetupBodyType,
  LoginBodyType,
  CreateUserBodyType,
} from "./user.validator";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../../utils/error";

export class UserService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

  getStatus = async () => {
    const count = await this.prisma.user.count({
      where: { deletedAt: null },
    });
    return {
      hasUsers: count > 0,
      userCount: count,
    };
  };

  firstTimeSetup = async (data: FirstTimeSetupBodyType) => {
    // Check if any user exists
    const existingCount = await this.prisma.user.count({
      where: { deletedAt: null },
    });

    if (existingCount > 0) {
      throw new BadRequestError(
        "User sudah ada, tidak bisa melakukan first time setup",
      );
    }

    const hashedPassword = await this.password.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        password: hashedPassword,
        isActive: true,
        isSuperUser: true,
      },
    });

    const token = await this.jwt.sign({
      userId: user.id,
      name: user.name,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        isActive: user.isActive,
        isSuperUser: user.isSuperUser,
      },
      accessToken: token,
    };
  };

  login = async (data: LoginBodyType) => {
    const user = await this.prisma.user.findFirst({
      where: {
        name: data.name,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedError({ message: "Username atau password salah" });
    }

    if (!user.isActive) {
      throw new UnauthorizedError({ message: "User tidak aktif" });
    }

    const isPasswordValid = await this.password.verify(
      data.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError({ message: "Username atau password salah" });
    }

    const token = await this.jwt.sign({
      userId: user.id,
      name: user.name,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        isActive: user.isActive,
        isSuperUser: user.isSuperUser,
      },
      accessToken: token,
    };
  };

  // TODO: change this - add proper authorization check
  createUser = async (data: CreateUserBodyType) => {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        name: data.name,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new BadRequestError("Username sudah digunakan");
    }

    const hashedPassword = await this.password.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        password: hashedPassword,
        isActive: data.isActive,
        isSuperUser: false,
      },
    });

    return {
      id: user.id,
      name: user.name,
      isActive: user.isActive,
      isSuperUser: user.isSuperUser,
    };
  };

  whoami = async (userId: number) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    return {
      id: user.id,
      name: user.name,
      isActive: user.isActive,
      isSuperUser: user.isSuperUser,
    };
  };
}
