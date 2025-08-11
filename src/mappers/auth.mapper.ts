import { AuthResult, TokenPair } from "../dtos/auth.dto";
import { User } from "../entity/User";
import { AccessTokenClaims } from "../types/claims";
import { buildPublicUserDto } from "./user.mapper";

export const buildAuthResult = (user: User, tokenPair: TokenPair): AuthResult => {
    return {
        user: buildPublicUserDto(user),
        tokens: tokenPair,
    };
};

export const buildTokenPair = (accessToken: string, refreshToken: string): TokenPair => {
    return {
        accessToken,
        refreshToken,
    };
};

export const buildAccessTokenClaims = (userId: number, role: string): AccessTokenClaims => {
    return { sub: String(userId), role };
};
