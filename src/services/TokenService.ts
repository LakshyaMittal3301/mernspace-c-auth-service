import { sign } from "jsonwebtoken";
import { Repository } from "typeorm";
import { RefreshToken } from "../entity/RefreshToken";
import { Config } from "../config";
import { ITokenService } from "../interfaces/services/ITokenService";
import { AccessTokenClaims, RefreshTokenClaims } from "../types/claims";
import { SecretNotFoundError } from "../errors/SecretNotFoundError";

export default class TokenService implements ITokenService {
    private accessTokenPrivateKey: string | undefined;
    private refreshTokenSecret: string | undefined;

    constructor(private refreshTokenRepository: Repository<RefreshToken>) {
        this.accessTokenPrivateKey = Config.PRIVATE_KEY;
        this.refreshTokenSecret = Config.REFRESH_TOKEN_SECRET;
    }

    generateAccessToken(claims: AccessTokenClaims): string {
        if (!this.accessTokenPrivateKey) {
            throw new SecretNotFoundError("Access Token Private Key");
        }
        return sign(claims, this.accessTokenPrivateKey, {
            algorithm: "RS256",
            expiresIn: "1h",
            issuer: "auth-service",
        });
    }

    async generateRefreshToken(userId: number): Promise<string> {
        if (!this.refreshTokenSecret) {
            throw new SecretNotFoundError("Refresh Token Secret");
        }
        const MS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

        const newRefreshTokenRecord = await this.refreshTokenRepository.save({
            user: { id: userId },
            expiresAt: new Date(Date.now() + MS_IN_YEAR),
        });

        const claims: RefreshTokenClaims = {
            sub: String(userId),
            jti: String(newRefreshTokenRecord.id),
        };

        const refreshToken = sign(claims, this.refreshTokenSecret, {
            algorithm: "HS256",
            expiresIn: "1y",
            issuer: "auth-service",
        });

        return refreshToken;
    }

    async isRefreshTokenActive(refreshTokenId: string, userId?: number): Promise<boolean> {
        const id = Number(refreshTokenId);
        const where = userId ? { id, user: { id: userId } } : { id };
        const refreshTokenRecord = await this.refreshTokenRepository.findOne({ where });
        return !!refreshTokenRecord && refreshTokenRecord.expiresAt > new Date();
    }

    async revokeRefreshToken(refreshTokenId: string): Promise<void> {
        await this.refreshTokenRepository.delete({ id: Number(refreshTokenId) });
    }
}
