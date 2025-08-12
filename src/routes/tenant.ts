import express, { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Tenant } from "../entity/Tenant";
import TenantService from "../services/TenantService";
import TenantController from "../controllers/TenantController";
import logger from "../config/logger";
import { makeAuthenticateMiddleware } from "../middlewares/authenticate";
import { Roles } from "../constants";
import { canAccess } from "../middlewares/canAccess";
import { AuthenticatedRequest, UpdateTenantRequest } from "../types/requests";

import createTenantValidator from "../validators/create-tenant-validator";
import updateTenantValidator from "../validators/update-tenant-validator";

// Repository
const tenantRepository = AppDataSource.getRepository(Tenant);

// Service
const tenantService = new TenantService(tenantRepository);

// Controller
const tenantController = new TenantController(logger, tenantService);

// Middleware
const authenticate = makeAuthenticateMiddleware();

// Router
const router = express.Router();

router.post(
    "/",
    authenticate,
    (req: Request, res: Response, next: NextFunction) =>
        canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
    createTenantValidator,
    (req: Request, res: Response) => tenantController.create(req, res),
);

router.get(
    "/",
    authenticate,
    (req: Request, res: Response, next: NextFunction) =>
        canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
    (req, res) => tenantController.getAll(req, res),
);

router.get(
    "/:id",
    authenticate,
    (req: Request, res: Response, next: NextFunction) =>
        canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
    (req, res) => tenantController.getById(req, res),
);

router.patch(
    "/:id",
    authenticate,
    (req: Request, res: Response, next: NextFunction) =>
        canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
    updateTenantValidator,
    (req: Request, res: Response) => tenantController.update(req as UpdateTenantRequest, res),
);

export default router;
