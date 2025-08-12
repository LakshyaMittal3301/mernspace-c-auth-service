import express from "express";
import { AppDataSource } from "../config/data-source";
import { Tenant } from "../entity/Tenant";
import TenantService from "../services/TenantService";
import TenantController from "../controllers/TenantController";
import logger from "../config/logger";
import { makeAuthenticateMiddleware } from "../middlewares/authenticate";
import { Roles } from "../constants";
import { canAccess } from "../middlewares/canAccess";
import { AuthenticatedRequest } from "../types/requests";

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
    (req, res, next) => canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
    (req, res) => tenantController.create(req, res),
);

export default router;
