import { Request, Response } from "express";
import { CreateAdminUserRequest, CreateManagerUserRequest } from "../../types/requests";

export interface IAdminUserController {
    list(req: Request, res: Response): Promise<void>;
    createAdmin(req: CreateAdminUserRequest, res: Response): Promise<void>;
    createManager(req: CreateManagerUserRequest, res: Response): Promise<void>;
}
