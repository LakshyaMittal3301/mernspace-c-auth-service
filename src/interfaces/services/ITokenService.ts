import { JwtPayload } from "jsonwebtoken";

export type AccessTokenPayload = JwtPayload & {
    sub: string;
    email?: string;
    role?: string;
};

export type RefreshTokenPayload = AccessTokenPayload;

export interface ITokenService {
    generateAccessToken(payload: AccessTokenPayload): string;
    generateRefreshToken(payload: RefreshTokenPayload, userId: number): Promise<string>;
}
