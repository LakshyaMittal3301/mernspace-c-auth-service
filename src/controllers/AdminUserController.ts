import { Logger } from "winston";
import { IAdminUserController } from "../interfaces/controllers/IAdminUserController";
import { Request, Response } from "express";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";
import { CreateAdminUserRequest } from "../types/requests";
import { validationResult } from "express-validator";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import createHttpError from "http-errors";

export default class AdminUserController implements IAdminUserController {
    constructor(
        private logger: Logger,
        private adminUserService: IAdminUserService,
    ) {}

    async list(req: Request, res: Response): Promise<void> {
        try {
            const users = await this.adminUserService.list();
            res.status(200).json({ users });
        } catch (err) {
            this.logger.error("Error occured while fetching all users", { error: err });
            throw err;
        }
    }

    async createAdmin(req: CreateAdminUserRequest, res: Response): Promise<void> {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }

            const user = await this.adminUserService.createAdmin(req.body);
            res.status(201).json({ user });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
                throw createHttpError(400, err);
            }
            this.logger.info("Error occured while creating admin", { error: err });
            throw err;
        }
    }
}
