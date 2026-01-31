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

export class UserService extends BaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

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

    const deletedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
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
