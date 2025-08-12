import { CreateTenantDto, PublicTenantDto, UpdateTenantDto } from "../../dtos/tenant.dto";
import { Tenant } from "../../entity/Tenant";

export interface ITenantService {
    create(createTenantDto: CreateTenantDto): Promise<Tenant>;
    getAll(): Promise<PublicTenantDto[]>;
    getById(id: number): Promise<PublicTenantDto | null>;
    update(id: number, updateTenantDto: UpdateTenantDto): Promise<PublicTenantDto | null>;
    delete(id: number): Promise<void>;
}
