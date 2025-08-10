import { IAuthController } from "../interfaces/controllers/IAuthController";

import { Logger } from "winston";
import { IAuthService } from "../interfaces/services/IAuthService";

import { RegisterRequest, LoginRequest, AuthenticatedRequest } from "../types/requests";
import { Response } from "express";

import { validationResult } from "express-validator";

import createHttpError from "http-errors";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import { TokenPair } from "../dtos/auth.dto";
import { toRefreshDto } from "../mappers/claims.mapper";

export default class AuthController implements IAuthController {
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
            this.setTokens(res, tokens);
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
            this.setTokens(res, tokens);
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
        const user = await this.authService.whoAmI(Number(userId));
        res.json(user);
    }

    async refresh(req: AuthenticatedRequest, res: Response) {
        try {
            const tokens = await this.authService.refresh(toRefreshDto(req.auth));
            this.setTokens(res, tokens);
            res.json({});
        } catch (err) {
            this.logger.error("Refresh failed, ", { error: err });
            throw createHttpError(400, "Refresh Failed");
        }
    }

    private setAccessToken(res: Response, accessToken: string) {
        res.cookie("accessToken", accessToken, {
            domain: "localhost",
            sameSite: "strict",
            maxAge: 1000 * 60 * 60,
            httpOnly: true,
        });
    }

    private setRefreshToken(res: Response, refreshToken: string) {
        res.cookie("refreshToken", refreshToken, {
            domain: "localhost",
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24 * 365,
            httpOnly: true,
        });
    }

    private setTokens(res: Response, tokens: TokenPair) {
        this.setAccessToken(res, tokens.accessToken);
        this.setRefreshToken(res, tokens.refreshToken);
    }
}
