import { RegisterRequest, LoginRequest, AuthenticatedRequest } from "../../types/requests";
import { Response } from "express";

export interface IAuthController {
    register(req: RegisterRequest, res: Response): void;
    login(req: LoginRequest, res: Response): void;
    self(req: AuthenticatedRequest, res: Response): void;
    refresh(req: AuthenticatedRequest, res: Response): void;
}
