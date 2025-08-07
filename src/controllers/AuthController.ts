import { Response } from "express";
import { RegisterUserRequest } from "../types/index";
import UserService from "../services/UserService";
import createHttpError from "http-errors";
import { Logger } from "winston";

export class AuthController {
    constructor(
        private userService: UserService,
        private logger: Logger,
    ) {}

    async register(req: RegisterUserRequest, res: Response) {
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

            res.status(201).json({ id: newUser.id });
        } catch (err) {
            throw createHttpError(500, "Registration Failed", { cause: err });
        }
    }
}
