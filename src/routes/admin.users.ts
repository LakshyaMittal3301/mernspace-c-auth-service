import express, { Request, Response, NextFunction } from "express";
import { makeAuthenticateMiddleware } from "../middlewares/authenticate";
import { Roles } from "../constants";
import { canAccess } from "../middlewares/canAccess";
import { AuthenticatedRequest, UpdateUserRequest } from "../types/requests";
import AdminUserController from "../controllers/AdminUserController";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import AdminUserService from "../services/AdminUserService";
import logger from "../config/logger";
import createAdminUserValidator from "../validators/create-admin-user-validator";
import PasswordService from "../services/PasswordService";
import createManagerUserValidator from "../validators/create-manager-user-validator";
import updateUserValidator from "../validators/update-user-validator";
import { Tenant } from "../entity/Tenant";
import listUsersValidator from "../validators/list-users-validator";
import { handleValidation } from "../validators/handleValidation";

// Repository
const userRepository = AppDataSource.getRepository(User);
const tenantRepository = AppDataSource.getRepository(Tenant);

// Service
const passwordService = new PasswordService();
const adminUserService = new AdminUserService(userRepository, tenantRepository, passwordService);

// Controller
const ctrl = new AdminUserController(logger, adminUserService);

// Middleware
const authenticate = makeAuthenticateMiddleware();

// Router
const router = express.Router();

router.use(authenticate, (req: Request, res: Response, next: NextFunction) =>
    canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
);

router.get("/users", listUsersValidator, handleValidation, (req: Request, res: Response) => ctrl.list(req, res));

router.post("/users/admins", createAdminUserValidator, handleValidation, (req: Request, res: Response) =>
    ctrl.createAdmin(req, res),
);

router.post("/users/managers", createManagerUserValidator, handleValidation, (req: Request, res: Response) =>
    ctrl.createManager(req, res),
);

router.get("/users/:id", (req: Request, res: Response) => ctrl.getById(req, res));

router.patch("/users/:id", updateUserValidator, handleValidation, (req: Request, res: Response) =>
    ctrl.update(req as UpdateUserRequest, res),
);

router.delete("/users/:id", (req, res) => ctrl.delete(req, res));

export default router;
