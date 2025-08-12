export type CreateTenantDto = {
    name: string;
    address: string;
};

export type UpdateTenantDto = Partial<Pick<CreateTenantDto, "name" | "address">>;

export type PublicTenantDto = {
    id: number;
    name: string;
    address: string;
    createdAt: string;
};
