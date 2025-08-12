import { Request, Response } from "express";

export interface IAdminUserController {
    list(req: Request, res: Response): Promise<void>;
}
