import { expressjwt } from "express-jwt";
import { Config } from "../config";
import { Request } from "express";
import { ITokenService } from "../interfaces/services/ITokenService";
import logger from "../config/logger";
import { Jwt, JwtPayload } from "jsonwebtoken";

export const makeRefreshJwtMiddleware = (tokenService: ITokenService) =>
    expressjwt({
        secret: Config.REFRESH_TOKEN_SECRET!,
        algorithms: ["HS256"],
        getToken(req: Request) {
            const { refreshToken } = req.cookies;
            return refreshToken;
        },
        async isRevoked(req, token) {
            if (!token) return true;
            try {
                const payload = token.payload as JwtPayload;
                const jti = payload?.jti;
                const sub = payload?.sub;

                if (!jti || !sub) return true;

                const revoked = await tokenService.isRefreshTokenRevoked(Number(jti), Number(sub));
                return revoked;
            } catch (err) {
                logger.error("Error while checking if refresh token is revoked", {
                    tokenPayload: token.payload,
                    error: err,
                });
            }
            return true;
        },
    });
