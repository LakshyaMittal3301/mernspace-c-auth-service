import { Logger } from "winston";
import { IAdminUserController } from "../interfaces/controllers/IAdminUserController";
import { Request, Response } from "express";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";
import {
    CreateAdminUserRequest,
    CreateManagerUserRequest,
    ListUsersQuery,
    ListUsersRequest,
    UpdateUserRequest,
} from "../types/requests";
import { matchedData, validationResult } from "express-validator";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import createHttpError from "http-errors";
import { TenantNotFoundError } from "../errors/TenantNotFoundError";
import { normalizeListUsersQuery } from "./normalizers/users.normalize";

export default class AdminUserController implements IAdminUserController {
    constructor(
        private logger: Logger,
        private adminUserService: IAdminUserService,
    ) {}

    async list(req: ListUsersRequest, res: Response): Promise<void> {
        try {
            const queryData = matchedData(req, {
                locations: ["query"],
                includeOptionals: true,
            }) as Partial<ListUsersQuery>;

            const listUserDto = normalizeListUsersQuery(queryData);

            const listUserResult = await this.adminUserService.list(listUserDto);
            res.status(200).json(listUserResult);
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
            this.logger.error("Error occured while creating admin", { error: err });
            throw err;
        }
    }

    async createManager(req: CreateManagerUserRequest, res: Response): Promise<void> {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }

            const user = await this.adminUserService.createManager(req.body);
            res.status(201).json({ user });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError || err instanceof TenantNotFoundError) {
                throw createHttpError(400, err.message);
            }
            this.logger.error("Error occured while creating admin", { error: err });
            throw err;
        }
    }

    async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) throw createHttpError(400, "Invalid user Id");

            const user = await this.adminUserService.getById(id);
            if (!user) throw createHttpError(404, "User not found");

            res.status(200).json({ user });
        } catch (err) {
            this.logger.error("Error getting user by id", { error: err });
            throw err;
        }
    }

    async update(req: UpdateUserRequest, res: Response): Promise<void> {
        try {
            const result = validationResult(req);
            if (!result.isEmpty()) {
                res.status(400).json({ errors: result.array() });
                return;
            }

            const id = Number(req.params.id);
            if (isNaN(id)) throw createHttpError(400, "Invalid user Id");

            if (!req.body || Object.keys(req.body).length === 0)
                throw createHttpError(400, "No update fields provided");

            const user = await this.adminUserService.update(id, req.body);
            if (!user) throw createHttpError(404, "User not found");

            res.status(200).json({ user });
        } catch (err) {
            if (err instanceof UserAlreadyExistsError) throw createHttpError(400, err.message);
            if (err instanceof TenantNotFoundError) throw createHttpError(404, err.message);
            this.logger.error("Error updating the user", { error: err });
            throw err;
        }
    }

    async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) throw createHttpError(400, "Invalid user Id");
            await this.adminUserService.delete(id);
            res.sendStatus(204);
        } catch (err) {
            this.logger.error("Error deleting user", { error: err });
            throw err;
        }
    }
}
