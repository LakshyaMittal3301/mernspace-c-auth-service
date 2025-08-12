import { Response } from "express";
import { ITenantController } from "../interfaces/controllers/ITenantController";
import { CreateTenantRequest } from "../types/requests";
import { ITenantService } from "../interfaces/services/ITenantService";
import { Logger } from "winston";

export default class TenantController implements ITenantController {
    constructor(
        private logger: Logger,
        private tenantService: ITenantService,
    ) {}

    async create(req: CreateTenantRequest, res: Response): Promise<void> {
        try {
            // Validate
            // Call service
            const tenant = await this.tenantService.create(req.body);
            // return response
            res.status(201).json({ id: tenant.id });
        } catch (err) {
            this.logger.error("Error creating tenant", { err });
            throw err;
        }
    }
}
