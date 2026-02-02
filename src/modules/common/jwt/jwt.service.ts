import jwt, { JwtPayload as JwtLibPayload } from "jsonwebtoken";
import { Config } from "../../../config";

export type JwtPayload = {
  userId: number;
  name: string;
};

function isJwtPayload(x: unknown): x is JwtPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.userId === "number" && typeof o.name === "string";
}

export class JwtService {
  private readonly secret: string;

  constructor(private readonly config: Config) {
    this.secret = config.common.JWT_SECRET;
  }

  async sign(payload: JwtPayload): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      jwt.sign(
        payload,
        this.secret,
        {
          algorithm: "HS256",
          // jsonwebtoken akan otomatis menambah "iat" untuk object payload (default behavior)
        },
        (err, token) => {
          if (err || !token)
            return reject(err ?? new Error("Failed to sign JWT"));
          resolve(token);
        },
      );
    });
  }

  async verify(token: string): Promise<JwtPayload | null> {
    try {
      const decoded = await new Promise<JwtLibPayload | string>(
        (resolve, reject) => {
          jwt.verify(
            token,
            this.secret,
            { algorithms: ["HS256"] },
            (err, payload) => {
              if (err || !payload)
                return reject(err ?? new Error("Invalid JWT"));
              resolve(payload);
            },
          );
        },
      );

      // Kalau payload berupa string, itu bukan case yang kita mau
      if (typeof decoded === "string") return null;

      // Ambil hanya field yang kita butuhkan (abaikan iat/exp dll)
      const picked = {
        userId: (decoded as any).userId,
        name: (decoded as any).name,
      };
      return isJwtPayload(picked) ? picked : null;
    } catch {
      return null;
    }
  }
}
