import { Request } from "express";
import { RegisterDto, LoginDto } from "../dtos/auth.dto";
import { AccessTokenClaims, RefreshTokenClaims } from "./claims";
import { CreateTenantDto, UpdateTenantDto } from "../dtos/tenant.dto";

export type RegisterRequest = Request<{}, {}, RegisterDto>;

export type LoginRequest = Request<{}, {}, LoginDto>;

export type AuthenticatedRequest = Request & { auth: AccessTokenClaims };

export type RefreshRequest = Request & { refresh: RefreshTokenClaims };

export type AuthenticatedRefreshRequest = Request & {
    auth: AccessTokenClaims;
    refresh: RefreshTokenClaims;
};

export type CreateTenantRequest = Request<{}, {}, CreateTenantDto>;

export type UpdateTenantRequest = Request<{ id: string }, {}, UpdateTenantDto>;
