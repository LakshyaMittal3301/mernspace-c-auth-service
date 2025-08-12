import { Response } from "express";
import { CreateTenantRequest } from "../../types/requests";

export interface ITenantController {
    create(req: CreateTenantRequest, res: Response): Promise<void>;
}
