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

export type AdminViewUserDto = PublicUserDto & {
    tenantId: number | null;
};

export type CreateAdminUserDto = {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
};

export type CreateManagerUserDto = {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    tenantId: number;
};
