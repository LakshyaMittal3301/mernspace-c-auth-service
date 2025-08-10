import { AppClaims } from "../types/claims";
import { PublicUserDto } from "./user.dto";

export type RegisterDto = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
};

export type LoginDto = {
    email: string;
    password: string;
};

export type RefreshDto = {
    payload: AppClaims;
};

export type TokenPair = {
    accessToken: string;
    refreshToken: string;
};

export type AuthResult = {
    user: PublicUserDto;
    tokens: TokenPair;
};
