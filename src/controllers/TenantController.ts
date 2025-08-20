import { Request, Response } from "express";
import { ITenantController } from "../interfaces/controllers/ITenantController";
import { CreateTenantRequest, UpdateTenantRequest } from "../types/requests";
import { ITenantService } from "../interfaces/services/ITenantService";
import { Logger } from "winston";
import { validationResult } from "express-validator";
import createHttpError from "http-errors";

export default class TenantController implements ITenantController {
    constructor(
        private logger: Logger,
        private tenantService: ITenantService,
    ) {}

    async create(req: CreateTenantRequest, res: Response): Promise<void> {
        try {
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

    async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) {
                throw createHttpError(400, "Invalid tenant id");
            }

            const tenant = await this.tenantService.getById(id);
            if (!tenant) {
                throw createHttpError(404, "Tenant not found");
            }

            res.status(200).json({ tenant });
        } catch (err) {
            this.logger.error("Error in getting tenant by id", { error: err });
            throw err;
        }
    }

    async update(req: UpdateTenantRequest, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);

            if (isNaN(id)) throw createHttpError(400, "Invalid tenant id");

            if (!req.body || Object.keys(req.body).length === 0)
                throw createHttpError(400, "No update fields provided");

            const tenant = await this.tenantService.update(id, req.body);
            if (!tenant) throw createHttpError(404, "Tenant not found");

            res.status(200).json({ tenant });
        } catch (err) {
            this.logger.error("Error updating tenant", { error: err });
            throw err;
        }
    }

    async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) throw createHttpError(400, "Invalid tenant id");
            await this.tenantService.delete(id);
            res.sendStatus(204);
        } catch (err) {
            this.logger.error("Error deleting tenant", { error: err });
            throw err;
        }
    }
}
