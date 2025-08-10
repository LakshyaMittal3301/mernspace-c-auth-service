import { JwtPayload } from "jsonwebtoken";
import { AppClaims } from "../../types/claims";

export type TokenPayload = JwtPayload & {
    sub: string;
    email?: string;
    role?: string;
};

export interface ITokenService {
    generateAccessToken(payload: AppClaims): string;
    generateRefreshToken(payload: AppClaims, userId: number): Promise<string>;
    isRefreshTokenRevoked(refreshTokenId: number, userId: number): Promise<boolean>;
}
