export type CreateTenantDto = {
    name: string;
    address: string;
};

export type PublicTenantDto = {
    id: number;
    name: string;
    address: string;
    createdAt: string;
};
