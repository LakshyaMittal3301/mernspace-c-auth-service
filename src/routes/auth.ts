import express from "express";
import { AuthController } from "../controllers/AuthController";
import UserService from "../services/UserService";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import logger from "../config/logger";
import registerValidator from "../validators/register-validator";
import { Request, Response } from "express";
import TokenService from "../services/TokenService";
import { RefreshToken } from "../entity/RefreshToken";
import PasswordService from "../services/PasswordService";
import AuthService from "../services/AuthService";

const router = express.Router();

const userRepository = AppDataSource.getRepository(User);
const userService = new UserService(userRepository);

const tokenRepository = AppDataSource.getRepository(RefreshToken);
const tokenService = new TokenService(tokenRepository);

const passwordService = new PasswordService();

const authService = new AuthService(logger, userService, passwordService, tokenService);

const authController = new AuthController(logger, authService);

router.post("/register", registerValidator, (req: Request, res: Response) => authController.register(req, res));

// router.post("/login", loginValidator, (req: Request, res: Response) =>
//     authController.login(req, res),
// );

export default router;
