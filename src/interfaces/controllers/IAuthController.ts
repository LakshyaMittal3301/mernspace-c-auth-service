import { Request, Response } from "express";
import { LoginDto, RegisterDto } from "../services/IAuthService";
import { JwtPayload } from "jsonwebtoken";

export type RegisterRequest = Request<{}, {}, RegisterDto>;

export type LoginRequest = Request<{}, {}, LoginDto>;

export type AppClaims = {
    sub: string;
    role: string;
};

export type FullJwtClaims = JwtPayload & AppClaims;

export type AuthenticatedRequest = Request & { auth: FullJwtClaims };

export interface IAuthController {
    register(req: RegisterRequest, res: Response): void;
    login(req: LoginRequest, res: Response): void;
    self(req: AuthenticatedRequest, res: Response): void;
    refresh(req: AuthenticatedRequest, res: Response): void;
}
