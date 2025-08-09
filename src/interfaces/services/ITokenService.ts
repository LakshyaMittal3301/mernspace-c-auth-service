import { JwtPayload } from "jsonwebtoken";

export type TokenPayload = JwtPayload & {
    sub: string;
    email?: string;
    role?: string;
};

export interface ITokenService {
    generateAccessToken(payload: TokenPayload): string;
    generateRefreshToken(payload: TokenPayload, userId: number): Promise<string>;
}
