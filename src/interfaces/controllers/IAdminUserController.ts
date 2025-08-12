import { Request, Response } from "express";
import { CreateAdminUserRequest, CreateManagerUserRequest, UpdateUserRequest } from "../../types/requests";

export interface IAdminUserController {
    list(req: Request, res: Response): Promise<void>;
    createAdmin(req: CreateAdminUserRequest, res: Response): Promise<void>;
    createManager(req: CreateManagerUserRequest, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    update(req: UpdateUserRequest, res: Response): Promise<void>;
}
