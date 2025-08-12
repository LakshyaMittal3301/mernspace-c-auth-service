import { Request, Response } from "express";
import { CreateTenantRequest, UpdateTenantRequest } from "../../types/requests";

export interface ITenantController {
    create(req: CreateTenantRequest, res: Response): Promise<void>;
    getAll(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    update(req: UpdateTenantRequest, res: Response): Promise<void>;
    delete(req: Request, res: Response): Promise<void>;
}
