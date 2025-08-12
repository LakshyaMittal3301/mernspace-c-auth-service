import express, { Request, Response, NextFunction } from "express";
import { makeAuthenticateMiddleware } from "../middlewares/authenticate";
import { Roles } from "../constants";
import { canAccess } from "../middlewares/canAccess";
import { AuthenticatedRequest } from "../types/requests";
import AdminUserController from "../controllers/AdminUserController";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import AdminUserService from "../services/AdminUserService";
import logger from "../config/logger";
import createAdminUserValidator from "../validators/create-admin-user-validator";
import PasswordService from "../services/PasswordService";
import createManagerUserValidator from "../validators/create-manager-user-validator";

// Repository
const userRepository = AppDataSource.getRepository(User);

// Service
const passwordService = new PasswordService();
const adminUserService = new AdminUserService(userRepository, passwordService);

// Controller
const ctrl = new AdminUserController(logger, adminUserService);

// Middleware
const authenticate = makeAuthenticateMiddleware();

// Router
const router = express.Router();

router.use(authenticate, (req: Request, res: Response, next: NextFunction) =>
    canAccess([Roles.ADMIN])(req as AuthenticatedRequest, res, next),
);

router.get("/users", (req, res) => ctrl.list(req, res));
router.post("/users/admins", createAdminUserValidator, (req: Request, res: Response) => ctrl.createAdmin(req, res));
router.post("/users/managers", createManagerUserValidator, (req: Request, res: Response) =>
    ctrl.createManager(req, res),
);
router.get("/users/:id", (req: Request, res: Response) => ctrl.getById(req, res));
// router.patch("/users/:id");
// router.delete("/users/:id");

export default router;
