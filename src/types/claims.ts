export type AccessTokenClaims = {
    sub: string;
    role: string;
};

export type RefreshTokenClaims = {
    sub: string;
    jti: string;
};
