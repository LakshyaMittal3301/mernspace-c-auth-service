import { Logger } from "winston";
import { IAdminUserController } from "../interfaces/controllers/IAdminUserController";
import { Request, Response } from "express";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";

export default class AdminUserController implements IAdminUserController {
    constructor(
        private logger: Logger,
        private userService: IAdminUserService,
    ) {}

    async list(req: Request, res: Response): Promise<void> {
        try {
            const users = await this.userService.list();
            res.status(200).json({ users });
        } catch (err) {
            this.logger.error("Error occured while fetching all users", { error: err });
            throw err;
        }
    }
}
