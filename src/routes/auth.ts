import { AppDataSource } from "../config/data-source";
import { RefreshToken } from "../entity/RefreshToken";
import { User } from "../entity/User";

import logger from "../config/logger";

import AuthService from "../services/AuthService";
import PasswordService from "../services/PasswordService";
import TokenService from "../services/TokenService";
import UserService from "../services/UserService";

import AuthController from "../controllers/AuthController";

import registerValidator from "../validators/register-validator";
import loginValidator from "../validators/login-validator";

import { makeAuthenticateMiddleware } from "../middlewares/authenticate";
import { makeValidateRefreshTokenMiddleware } from "../middlewares/validateRefreshToken";

import express, { Request, Response } from "express";

import { AuthenticatedRefreshRequest, AuthenticatedRequest, RefreshRequest } from "../types/requests";
import { makeParseRefreshTokenMiddleware } from "../middlewares/parseRefreshToken";
import { Tenant } from "../entity/Tenant";
import TenantService from "../services/TenantService";
import { handleValidation } from "../validators/handleValidation";

// Repositories
const userRepository = AppDataSource.getRepository(User);
const tokenRepository = AppDataSource.getRepository(RefreshToken);
const tenantRepository = AppDataSource.getRepository(Tenant);

// Services
const userService = new UserService(userRepository);
const tokenService = new TokenService(tokenRepository);
const passwordService = new PasswordService();
const tenantService = new TenantService(tenantRepository);
const authService = new AuthService(logger, userService, passwordService, tokenService, tenantService);

// Controllers
const authController = new AuthController(logger, authService);

// Middlewares
const authenticate = makeAuthenticateMiddleware();
const validateRefreshToken = makeValidateRefreshTokenMiddleware(tokenService);
const parseRefreshToken = makeParseRefreshTokenMiddleware();

// Router
const router = express.Router();

// Routes
router.post("/register", registerValidator, handleValidation, (req: Request, res: Response) =>
    authController.register(req, res),
);
router.post("/login", loginValidator, handleValidation, (req: Request, res: Response) =>
    authController.login(req, res),
);
router.get("/self", authenticate, (req, res) => authController.self(req as AuthenticatedRequest, res));
router.post("/refresh", validateRefreshToken, (req, res) => authController.refresh(req as RefreshRequest, res));
router.post("/logout", authenticate, parseRefreshToken, (req, res) =>
    authController.logout(req as AuthenticatedRefreshRequest, res),
);

export default router;
