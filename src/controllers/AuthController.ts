import { Response } from "express";
import { RegisterUserRequest } from "../types/index";
import UserService from "../services/UserService";
import createHttpError from "http-errors";
import { Logger } from "winston";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { validationResult } from "express-validator";
import { JwtPayload, sign } from "jsonwebtoken";
import TokenService from "../services/TokenService";

export class AuthController {
    constructor(
        private userService: UserService,
        private logger: Logger,
        private tokenService: TokenService,
    ) {}

    async register(req: RegisterUserRequest, res: Response) {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                return res.status(400).json({ errors: result.array() });
            }

            const { firstName, lastName, email, password } = req.body;

            const newUser = await this.userService.create({
                firstName,
                lastName,
                email,
                password,
            });

            this.logger.info("User created successfully", {
                id: newUser.id,
            });

            const payload: JwtPayload = {
                sub: String(newUser.id),
                role: newUser.role,
            };

            const accessToken = this.tokenService.generateAccessToken(payload);

            const refreshToken = await this.tokenService.generateRefreshToken(
                payload,
                newUser,
            );

            res.cookie("accessToken", accessToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60,
                httpOnly: true,
            });

            res.cookie("refreshToken", refreshToken, {
                domain: "localhost",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60 * 24 * 365,
                httpOnly: true,
            });

            res.status(201).json({ id: newUser.id });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
                throw createHttpError(400, err);
            }

            // Internal Error
            this.logger.error("User Registration Failed", { error: err });
            throw createHttpError(500, "Registration Failed");
        }
    }
}
