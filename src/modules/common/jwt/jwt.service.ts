import * as jose from "jose";
import { Config } from "../../../config";

export type JwtPayload = {
  userId: number;
  name: string;
};

export class JwtService {
  private readonly secret: Uint8Array;

  constructor(private readonly config: Config) {
    this.secret = new TextEncoder().encode(config.common.JWT_SECRET);
  }

  async sign(payload: JwtPayload): Promise<string> {
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(this.secret);

    return token;
  }

  async verify(token: string): Promise<JwtPayload | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret);
      return payload as unknown as JwtPayload;
    } catch {
      return null;
    }
  }
}
