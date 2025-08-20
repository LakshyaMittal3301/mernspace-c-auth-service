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

export type UpdateUserDto = {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    tenantId?: number;
};

export type SortField = "id" | "createdAt";
export type SortOrder = "asc" | "desc";
export type UserRole = "admin" | "manager" | "customer";

export type ListUsersDto = {
    pagination: { page: number; limit: number };
    sort: { field: SortField; order: SortOrder };
    filters: { q?: string; role?: string };
};

export type ListUsersResult = {
    rows: AdminViewUserDto[];
    page: number;
    limit: number;
    sort: SortField;
    order: SortOrder;
    total: number;
    totalPages: number;
};
