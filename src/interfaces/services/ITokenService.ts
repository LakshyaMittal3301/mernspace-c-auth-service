import { AccessTokenClaims } from "../../types/claims";

export interface ITokenService {
    generateAccessToken(claims: AccessTokenClaims): string;
    generateRefreshToken(userId: number): Promise<string>;
    isRefreshTokenActive(refreshTokenId: string, userId?: number): Promise<boolean>;
    revokeRefreshToken(refreshTokenId: string): Promise<void>;
}
