import { IAuthController } from "../interfaces/controllers/IAuthController";

import { Logger } from "winston";
import { IAuthService } from "../interfaces/services/IAuthService";

import {
    RegisterRequest,
    LoginRequest,
    AuthenticatedRequest,
    RefreshRequest,
    AuthenticatedRefreshRequest,
} from "../types/requests";
import { Response } from "express";
import { TokenPair } from "../dtos/auth.dto";

import { validationResult } from "express-validator";

import createHttpError from "http-errors";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import { SecretNotFoundError } from "../errors/SecretNotFoundError";

export default class AuthController implements IAuthController {
    constructor(
        private logger: Logger,
        private authService: IAuthService,
    ) {}

    async register(req: RegisterRequest, res: Response): Promise<void> {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }

            const { user, tokens } = await this.authService.register(req.body);
            this.setTokens(res, tokens);
            res.status(201).json({ id: user.id });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
                throw createHttpError(400, err.message);
            }
            if (err instanceof SecretNotFoundError) {
                throw createHttpError(500, err.message);
            }

            // Internal Error
            this.logger.error("User Registration Failed", { error: err });
            throw createHttpError(500, "Registration Failed");
        }
    }

    async login(req: LoginRequest, res: Response): Promise<void> {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }

            const { user, tokens } = await this.authService.login(req.body);
            this.setTokens(res, tokens);
            res.status(200).json({ id: user.id });
        } catch (err) {
            if (err instanceof InvalidCredentialsError) {
                throw createHttpError(401, err.message);
            }
            if (err instanceof SecretNotFoundError) {
                throw createHttpError(500, err.message);
            }

            // Login Failed
            this.logger.error("User Login Failed", { error: err });
            throw createHttpError(500, "Login Failed");
        }
    }

    async self(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.auth.sub;
        const user = await this.authService.whoAmI(Number(userId));
        res.json(user);
    }

    async refresh(req: RefreshRequest, res: Response) {
        try {
            const userId = Number(req.refresh.sub);
            const refreshTokenId = req.refresh.jti;
            const tokens = await this.authService.refresh({ userId, refreshTokenId });
            this.setTokens(res, tokens);
            res.json({});
        } catch (err) {
            if (err instanceof SecretNotFoundError) {
                throw createHttpError(500, err.message);
            }
            this.logger.error("Refresh failed, ", { error: err });
            throw createHttpError(400, "Refresh Failed");
        }
    }

    async logout(req: AuthenticatedRefreshRequest, res: Response): Promise<void> {
        try {
            const { jti: refreshTokenId } = req.refresh;
            await this.authService.logout({ refreshTokenId });
        } catch (err) {
            this.logger.error("Logout Failed", { error: err });
        } finally {
            this.clearTokens(res);
            res.status(204).end();
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

    private clearAccessToken(res: Response) {
        res.clearCookie("accessToken", {
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

    private clearRefreshToken(res: Response) {
        res.clearCookie("refreshToken", {
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

    private clearTokens(res: Response) {
        this.clearAccessToken(res);
        this.clearRefreshToken(res);
    }
}
