import { Request } from "express";
import { expressjwt } from "express-jwt";
import jwksClient from "jwks-rsa";
import { Config } from "../config";

export default expressjwt({
    secret: jwksClient.expressJwtSecret({
        jwksUri: Config.JWKS_URI!,
        cache: true,
        rateLimit: true,
    }),

    algorithms: ["RS256"],
    getToken(req: Request) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.split(" ")[1] !== "undefined") {
            const token = authHeader.split(" ")[1];
            if (token) return token;
        }

        const { accessToken } = req.cookies;
        return accessToken;
    },
});
