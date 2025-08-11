import { Request } from "express";
import { RegisterDto, LoginDto } from "../dtos/auth.dto";
import { AccessTokenClaims, RefreshTokenClaims } from "./claims";

export type RegisterRequest = Request<{}, {}, RegisterDto>;

export type LoginRequest = Request<{}, {}, LoginDto>;

export type AuthenticatedRequest = Request & { auth: AccessTokenClaims };

export type RefreshRequest = Request & { refresh: RefreshTokenClaims };
