import { Request } from "express";
import { FullJwtClaims } from "./claims";
import { RegisterDto, LoginDto } from "../dtos/auth.dto";

export type RegisterRequest = Request<{}, {}, RegisterDto>;

export type LoginRequest = Request<{}, {}, LoginDto>;

export type AuthenticatedRequest = Request & { auth: FullJwtClaims };
