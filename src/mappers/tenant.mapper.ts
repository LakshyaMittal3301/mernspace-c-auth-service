import { PublicTenantDto } from "../dtos/tenant.dto";
import { Tenant } from "../entity/Tenant";

export const toPublicTenantDto = (tenant: Tenant): PublicTenantDto => {
    return {
        id: tenant.id,
        name: tenant.name,
        address: tenant.address,
        createdAt: tenant.createdAt.toISOString(),
    };
};
