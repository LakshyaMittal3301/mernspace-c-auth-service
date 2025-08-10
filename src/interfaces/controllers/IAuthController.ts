import { Request, Response } from "express";
import { LoginDto, RegisterDto } from "../services/IAuthService";

export type RegisterRequest = Request<{}, {}, RegisterDto>;

export type LoginRequest = Request<{}, {}, LoginDto>;

type AuthClaims = {
    sub: string;
    role: string;
};

export type AuthenticatedRequest = Request & { auth: AuthClaims };

export interface IAuthController {
    register(req: RegisterRequest, res: Response): void;
    login(req: LoginRequest, res: Response): void;
    self(req: AuthenticatedRequest, res: Response): void;
}
