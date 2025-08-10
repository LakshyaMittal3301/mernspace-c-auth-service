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
import { makeRefreshJwtMiddleware } from "../middlewares/validateRefreshToken";

import express, { Request, Response } from "express";

import { AuthenticatedRequest } from "../types/requests";

// Repositories
const userRepository = AppDataSource.getRepository(User);
const tokenRepository = AppDataSource.getRepository(RefreshToken);

// Services
const userService = new UserService(userRepository);
const tokenService = new TokenService(tokenRepository);
const passwordService = new PasswordService();
const authService = new AuthService(logger, userService, passwordService, tokenService);

// Controllers
const authController = new AuthController(logger, authService);

// Middlewares
const authenticate = makeAuthenticateMiddleware();
const validateRefreshToken = makeRefreshJwtMiddleware(tokenService);

// Router
const router = express.Router();

// Routes
router.post("/register", registerValidator, (req: Request, res: Response) => authController.register(req, res));
router.post("/login", loginValidator, (req: Request, res: Response) => authController.login(req, res));
router.get("/self", authenticate, (req, res) => authController.self(req as AuthenticatedRequest, res));
router.post("/refresh", validateRefreshToken, (req, res) => authController.refresh(req as AuthenticatedRequest, res));

export default router;
