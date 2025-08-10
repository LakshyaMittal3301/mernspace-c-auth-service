import { AuthResult, TokenPair } from "../dtos/auth.dto";
import { User } from "../entity/User";
import { toPublicUserDto } from "./user.mapper";

export const toAuthResult = (user: User, tokenPair: TokenPair): AuthResult => {
    return {
        user: toPublicUserDto(user),
        tokens: tokenPair,
    };
};

export const toTokenPair = (accessToken: string, refreshToken: string): TokenPair => {
    return {
        accessToken,
        refreshToken,
    };
};
