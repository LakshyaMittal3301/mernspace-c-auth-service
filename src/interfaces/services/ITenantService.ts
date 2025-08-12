import { CreateTenantDto, PublicTenantDto } from "../../dtos/tenant.dto";
import { Tenant } from "../../entity/Tenant";

export interface ITenantService {
    create(createTenantDto: CreateTenantDto): Promise<Tenant>;
    getAll(): Promise<PublicTenantDto[]>;
}
