import createHttpError from "http-errors";
import { AuthenticatedRequest } from "../types/requests";
import { NextFunction, Response } from "express";

export const canAccess = (roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.auth.role;

    if (roles.includes(role)) return next();

    return next(createHttpError(403, "Not enough permissions to access this route"));
};
