import { expressjwt } from "express-jwt";
import { Config } from "../config";
import { Request } from "express";

export const makeParseRefreshTokenMiddleware = () =>
    expressjwt({
        secret: Config.REFRESH_TOKEN_SECRET!,
        algorithms: ["HS256"],
        getToken(req: Request) {
            const { refreshToken } = req.cookies;
            return refreshToken;
        },
    });
