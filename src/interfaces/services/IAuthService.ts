import { User } from "../../entity/User";

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

export type AuthResult = {
    user: User;
    tokens: TokenPair;
};

export interface IAuthService {
    register(registerDto: RegisterDto): Promise<AuthResult>;
}
