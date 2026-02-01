import { BaseService } from "../../../base/base-service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PasswordService } from "../../common/password/password.service";
import { JwtService } from "../../common/jwt/jwt.service";
import {
  FirstTimeSetupBodyType,
  LoginBodyType,
  CreateUserBodyType,
  EditProfileBodyType,
  ChangePasswordBodyType,
  ResetPasswordBodyType,
} from "./user.validator";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../../utils/error";
import { FilterQueryType } from "src/middleware/use-filter";
import { Prisma } from ".prisma/client";

export class UserService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

  private constructWhere(filter?: FilterQueryType): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      OR: filter?.search
        ? [{ name: { contains: filter.search, mode: "insensitive" } }]
        : undefined,
    };
    if (filter?.dateStart || filter?.dateEnd) {
      where.createdAt = {};

      if (filter.dateStart) {
        where.createdAt.gte = filter.dateStart;
      }

      if (filter.dateEnd) {
        const nextDay = new Date(filter.dateEnd);
        nextDay.setDate(nextDay.getDate() + 1);

        where.createdAt.lt = nextDay;
      }
    }
    return where;
  }

  private constructArgs(filter?: FilterQueryType): Prisma.UserFindManyArgs {
    const args: Prisma.UserFindManyArgs = {
      where: this.constructWhere(filter),
      skip: filter?.skip,
      take: filter?.limit,
      orderBy: this.constructOrder(filter),
      select: {
        id: true,
        name: true,
        isActive: true,
        isSuperUser: true,
        createdAt: true,
        updatedAt: true,
      },
    };
    return args;
  }

  private constructOrder(
    filter?: FilterQueryType,
  ): Prisma.UserOrderByWithRelationInput | undefined {
    switch (filter?.sortBy) {
      default:
        return filter?.sortBy
          ? { [filter?.sortBy]: filter?.sort }
          : { id: "desc" };
    }
  }

  getAllUsers = async (filter?: FilterQueryType) => {
    const [rows, count] = await Promise.all([
      this.prisma.user.findMany(this.constructArgs(filter)),
      this.prisma.user.count({
        where: this.constructWhere(filter),
      }),
    ]);

    const pagination = this.createPagination({
      total: count,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
    });
    return { rows, pagination };
  };

  // cek apakah ada user atau tidak (untuk kebutuhan setup aplikasi pertama kali)
  getStatus = async () => {
    const count = await this.prisma.user.count({
      where: { deletedAt: null },
    });
    return {
      hasUsers: count > 0,
      userCount: count,
    };
  };

  // first time setup (untuk kebutuhan setup aplikasi pertama kali => create super user)
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

  // mendapatkan kredensial
  login = async (data: LoginBodyType) => {
    const user = await this.prisma.user.findFirst({
      where: {
        name: data.name?.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestError("Username atau password salah");
    }

    if (!user.isActive) {
      throw new BadRequestError("User tidak aktif");
    }

    const isPasswordValid = await this.password.verify(
      data.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestError("Username atau password salah");
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

  // super user create user lain
  createUser = async (data: CreateUserBodyType) => {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        name: data.name?.toLowerCase(),
      },
    });

    if (existingUser && !existingUser.deletedAt) {
      throw new BadRequestError("Username sudah digunakan");
    }

    const hashedPassword = await this.password.hash(data.password);

    if (!existingUser) {
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
    } else {
      const user = await this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
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
    }
  };

  // cek profile sendiri
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

  // untuk edit profile sendiri
  editProfile = async (userId: number, data: EditProfileBodyType) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    if (user.name !== data.name) {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          name: data.name?.toLowerCase(),
        },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestError("Username sudah digunakan");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: data.name,
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      isActive: updatedUser.isActive,
      isSuperUser: updatedUser.isSuperUser,
    };
  };

  // change password sendiri
  changePassword = async (userId: number, data: ChangePasswordBodyType) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    const isPasswordValid = await this.password.verify(
      data.oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestError("Password lama salah");
    }

    const hashedPassword = await this.password.hash(data.newPassword);

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      isActive: updatedUser.isActive,
      isSuperUser: updatedUser.isSuperUser,
    };
  };

  // super user hapus user lain
  deleteUser = async (userId: number) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    if (user.isSuperUser) {
      throw new BadRequestError("Tidak bisa menghapus super user");
    }

    const newUserName = `${user.name}-deleted-${Date.now()}`;

    const deletedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: newUserName,
        deletedAt: new Date(),
      },
    });

    return {
      id: deletedUser.id,
      name: deletedUser.name,
      isActive: deletedUser.isActive,
      isSuperUser: deletedUser.isSuperUser,
    };
  };

  // super user change password user lain
  resetPassword = async (userId: number, data: ResetPasswordBodyType) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    const hashedPassword = await this.password.hash(data.newPassword);

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      isActive: updatedUser.isActive,
      isSuperUser: updatedUser.isSuperUser,
    };
  };
}
