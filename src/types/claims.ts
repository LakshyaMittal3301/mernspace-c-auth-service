import { JwtPayload } from "jsonwebtoken";

export type AppClaims = {
    sub: string;
    role: string;
};

export type FullJwtClaims = JwtPayload & AppClaims;
