import { AppClaims } from "../../types/claims";

export interface ITokenService {
    generateAccessToken(payload: AppClaims): string;
    generateRefreshToken(payload: AppClaims, userId: number): Promise<string>;
    isRefreshTokenRevoked(refreshTokenId: number, userId: number): Promise<boolean>;
    deleteToken(refreshTokenId: number): Promise<void>;
}
