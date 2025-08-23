export type AccessTokenClaims = {
    sub: string;
    role: string;
    tenantId?: string;
};

export type RefreshTokenClaims = {
    sub: string;
    jti: string;
};
