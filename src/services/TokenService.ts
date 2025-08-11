import { sign } from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { Repository } from "typeorm";
import { RefreshToken } from "../entity/RefreshToken";
import { Config } from "../config";
import { ITokenService } from "../interfaces/services/ITokenService";
import { AccessTokenClaims, RefreshTokenClaims } from "../types/claims";

export default class TokenService implements ITokenService {
    private privateKey: Buffer;

    constructor(private refreshTokenRepository: Repository<RefreshToken>) {
        this.privateKey = fs.readFileSync(path.join(__dirname, "../../certs/private.pem"));
    }

    generateAccessToken(claims: AccessTokenClaims): string {
        return sign(claims, this.privateKey, {
            algorithm: "RS256",
            expiresIn: "1h",
            issuer: "auth-service",
        });
    }

    async generateRefreshToken(userId: number): Promise<string> {
        const MS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

        const newRefreshTokenRecord = await this.refreshTokenRepository.save({
            user: { id: userId },
            expiresAt: new Date(Date.now() + MS_IN_YEAR),
        });

        const claims: RefreshTokenClaims = {
            sub: String(userId),
            jti: String(newRefreshTokenRecord.id),
        };

        const refreshToken = sign(claims, Config.REFRESH_TOKEN_SECRET!, {
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
