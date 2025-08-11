import { expressjwt } from "express-jwt";
import { Config } from "../config";
import { Request } from "express";
import { ITokenService } from "../interfaces/services/ITokenService";
import logger from "../config/logger";
import { JwtPayload } from "jsonwebtoken";

export const makeValidateRefreshTokenMiddleware = (tokenService: ITokenService) =>
    expressjwt({
        secret: Config.REFRESH_TOKEN_SECRET!,

        requestProperty: "refresh",

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

                const active = await tokenService.isRefreshTokenActive(jti, Number(sub));
                return !active;
            } catch (err) {
                logger.error("Error while checking if refresh token is revoked", {
                    tokenPayload: token.payload,
                    error: err,
                });
            }
            return true;
        },
    });
