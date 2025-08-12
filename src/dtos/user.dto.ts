export type CreateUserParams = {
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
    role?: string;
};

export type PublicUserDto = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
    role: string;
};

export type AdminUserDto = PublicUserDto & {
    tenantId: number | null;
};
