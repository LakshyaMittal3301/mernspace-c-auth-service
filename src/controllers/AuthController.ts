import fs from "fs";
import path from "path";
import { Response } from "express";
import { RegisterUserRequest } from "../types/index";
import UserService from "../services/UserService";
import createHttpError from "http-errors";
import { Logger } from "winston";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { validationResult } from "express-validator";
import { JwtPayload, sign } from "jsonwebtoken";
import { Config } from "../config";

export class AuthController {
    constructor(
        private userService: UserService,
        private logger: Logger,
    ) {}

    async register(req: RegisterUserRequest, res: Response) {
        const result = validationResult(req);
        if (!result.isEmpty()) {
            return res.status(400).json({ errors: result.array() });
        }

        const { firstName, lastName, email, password } = req.body;

        try {
            const newUser = await this.userService.create({
                firstName,
                lastName,
                email,
                password,
            });

            this.logger.info("User registered successfully", {
                id: newUser.id,
            });

            let privateKey: Buffer;
            try {
                privateKey = fs.readFileSync(
                    path.join(__dirname, "../../certs/private.pem"),
                );
            } catch (err) {
                this.logger.error("Error in reading private key", {
                    error: err,
                });
                throw createHttpError(500, "Error in reading private key");
            }

            const payload: JwtPayload = {
                sub: String(newUser.id),
                role: newUser.role,
            };

            const accessToken = sign(payload, privateKey, {
                algorithm: "RS256",
                expiresIn: "1h",
                issuer: "auth-service",
            });

            const refreshToken = sign(payload, Config.REFRESH_TOKEN_SECRET!, {
                algorithm: "HS256",
                expiresIn: "1y",
                issuer: "auth-service",
            });

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
