import { User } from "../../entity/User";
import { AppClaims } from "../controllers/IAuthController";
import { TokenPayload } from "./ITokenService";

export const toPublicUserDto = (u: User): PublicUserDto => {
    return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        createdAt: u.createdAt,
    };
};

export type RegisterDto = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
};

export type TokenPair = {
    accessToken: string;
    refreshToken: string;
};

export type PublicUserDto = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
};

export type AuthResult = {
    user: PublicUserDto;
    tokens: TokenPair;
};

export type LoginDto = {
    email: string;
    password: string;
};

export type RefreshDto = {
    payload: AppClaims;
};

export interface IAuthService {
    register(registerDto: RegisterDto): Promise<AuthResult>;
    login(loginDto: LoginDto): Promise<AuthResult>;
    whoAmI(userId: number): Promise<PublicUserDto>;
    refresh(refreshDto: RefreshDto): Promise<TokenPair>;
}
