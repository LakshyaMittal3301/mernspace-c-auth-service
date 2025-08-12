import { Request, Response } from "express";
import { ITenantController } from "../interfaces/controllers/ITenantController";
import { CreateTenantRequest } from "../types/requests";
import { ITenantService } from "../interfaces/services/ITenantService";
import { Logger } from "winston";
import { validationResult } from "express-validator";

export default class TenantController implements ITenantController {
    constructor(
        private logger: Logger,
        private tenantService: ITenantService,
    ) {}

    async create(req: CreateTenantRequest, res: Response): Promise<void> {
        try {
            // Validate
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }
            // Call service
            const tenant = await this.tenantService.create(req.body);
            // return response
            res.status(201).json({ id: tenant.id });
        } catch (err) {
            this.logger.error("Error creating tenant", { error: err });
            throw err;
        }
    }

    async getAll(req: Request, res: Response): Promise<void> {
        try {
            const tenants = await this.tenantService.getAll();
            res.status(200).json({ tenants });
        } catch (err) {
            this.logger.error("Error in getting all tenants", { error: err });
            throw err;
        }
    }
}
