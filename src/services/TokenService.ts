import { JwtPayload, sign } from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { Repository } from "typeorm";
import { RefreshToken } from "../entity/RefreshToken";
import { Config } from "../config";
import { ITokenService } from "../interfaces/services/ITokenService";
import { AppClaims } from "../types/claims";

export default class TokenService implements ITokenService {
    private privateKey: Buffer;

    constructor(private refreshTokenRepository: Repository<RefreshToken>) {
        this.privateKey = fs.readFileSync(path.join(__dirname, "../../certs/private.pem"));
    }

    generateAccessToken(payload: AppClaims): string {
        return sign(payload, this.privateKey, {
            algorithm: "RS256",
            expiresIn: "1h",
            issuer: "auth-service",
        });
    }

    async generateRefreshToken(payload: AppClaims, userId: number): Promise<string> {
        const MS_IN_YEAR = 1000 * 60 * 60 * 24 * 365;

        const newRefreshTokenRecord = await this.refreshTokenRepository.save({
            user: { id: userId },
            expiresAt: new Date(Date.now() + MS_IN_YEAR),
        });

        const refreshToken = sign(payload, Config.REFRESH_TOKEN_SECRET!, {
            algorithm: "HS256",
            expiresIn: "1y",
            issuer: "auth-service",
            jwtid: String(newRefreshTokenRecord.id),
        });

        return refreshToken;
    }

    async isRefreshTokenRevoked(refreshTokenId: number, userId: number): Promise<boolean> {
        const refreshTokenRecord = await this.refreshTokenRepository.findOne({
            where: {
                id: refreshTokenId,
                user: { id: userId },
            },
        });

        if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) return true;
        return false;
    }

    async deleteToken(refreshTokenId: number): Promise<void> {
        this.refreshTokenRepository.delete({
            id: refreshTokenId,
        });
    }
}
