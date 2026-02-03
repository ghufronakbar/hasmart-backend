import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../utils/error";
import { JwtService, JwtPayload } from "../modules/common/jwt/jwt.service";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const useAuth = (jwtService: JwtService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError();
      }

      const token = authHeader.substring(7);
      const payload = await jwtService.verifyAccess(token);

      if (!payload) {
        throw new UnauthorizedError();
      }

      req.user = payload;
      next();
    } catch (err) {
      next(new UnauthorizedError());
    }
  };
};
