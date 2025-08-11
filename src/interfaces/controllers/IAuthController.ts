import { RegisterRequest, LoginRequest, AuthenticatedRequest, RefreshRequest } from "../../types/requests";
import { Response } from "express";

export interface IAuthController {
    register(req: RegisterRequest, res: Response): Promise<void>;
    login(req: LoginRequest, res: Response): Promise<void>;
    self(req: AuthenticatedRequest, res: Response): Promise<void>;
    refresh(req: RefreshRequest, res: Response): Promise<void>;
}
