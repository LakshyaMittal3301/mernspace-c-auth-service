import express from "express";
import { AuthController } from "../controllers/AuthController";
import UserService from "../services/UserService";
import { AppDataSource } from "../config/data-source";
import { User } from "../entity/User";
import logger from "../config/logger";
import registerValidator from "../validators/register-validator";
import { Request, Response } from "express";

const router = express.Router();

const userRepository = AppDataSource.getRepository(User);
const userService = new UserService(userRepository);
const authController = new AuthController(userService, logger);

router.post("/register", registerValidator, (req: Request, res: Response) =>
    authController.register(req, res),
);

export default router;
