import { Response } from "express";
import createHttpError from "http-errors";
import { Logger } from "winston";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { validationResult } from "express-validator";
import { IAuthService } from "../interfaces/services/IAuthService";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import {
    AuthenticatedRequest,
    IAuthController,
    LoginRequest,
    RegisterRequest,
} from "../interfaces/controllers/IAuthController";

export class AuthController implements IAuthController {
    constructor(
        private logger: Logger,
        private authService: IAuthService,
    ) {}

    async register(req: RegisterRequest, res: Response) {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.status(400).json({ errors: result.array() });
            }

            const { user, tokens } = await this.authService.register(req.body);

            res.cookie("accessToken", tokens.accessToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60,
                httpOnly: true,
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 24 * 365,
                httpOnly: true,
            });

            res.status(201).json({ id: user.id });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
                throw createHttpError(400, err);
            }

            // Internal Error
            this.logger.error("User Registration Failed", { error: err });
            throw createHttpError(500, "Registration Failed");
        }
    }

    async login(req: LoginRequest, res: Response) {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.status(400).json({ errors: result.array() });
            }

            const { user, tokens } = await this.authService.login(req.body);

            res.cookie("accessToken", tokens.accessToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60,
                httpOnly: true,
            });

            res.cookie("refreshToken", tokens.refreshToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 24 * 365,
                httpOnly: true,
            });

            res.status(200).json({ id: user.id });
        } catch (err) {
            if (err instanceof InvalidCredentialsError) {
                throw createHttpError(401, err.message);
            }

            // Login Failed
            this.logger.error("User Login Failed", { error: err });
            throw createHttpError(500, "Login Failed");
        }
    }

    async self(req: AuthenticatedRequest, res: Response) {
        const userId = req.auth.sub;
        const user = await this.authService.findUserById(Number(userId));
        console.log("User: ", user);
        res.json(user);
    }
}
