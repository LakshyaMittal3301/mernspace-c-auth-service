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

router.use(authenticate, (req: Request, res: Response, next: NextFunction) =>
    canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
);

router.post("/", createTenantValidator, (req: Request, res: Response) => tenantController.create(req, res));

router.get("/", (req, res) => tenantController.getAll(req, res));

router.get("/:id", (req, res) => tenantController.getById(req, res));

router.patch("/:id", updateTenantValidator, (req: Request, res: Response) =>
    tenantController.update(req as UpdateTenantRequest, res),
);

router.delete("/:id", (req, res) => tenantController.delete(req, res));

export default router;
