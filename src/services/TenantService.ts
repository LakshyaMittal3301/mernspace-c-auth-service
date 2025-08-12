import { Repository } from "typeorm";
import { CreateTenantDto, PublicTenantDto } from "../dtos/tenant.dto";
import { Tenant } from "../entity/Tenant";
import { ITenantService } from "../interfaces/services/ITenantService";
import { toPublicTenantDto } from "../mappers/tenant.mapper";

export default class TenantService implements ITenantService {
    constructor(private tenantRepository: Repository<Tenant>) {}

    async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
        const { name, address } = createTenantDto;
        return await this.tenantRepository.save({ name, address });
    }

    async getAll(): Promise<PublicTenantDto[]> {
        const tenants = await this.tenantRepository.find({ order: { createdAt: "ASC" } });
        return tenants.map(toPublicTenantDto);
    }

    async getById(id: number): Promise<PublicTenantDto | null> {
        const tenant = await this.tenantRepository.findOne({ where: { id } });
        return tenant ? toPublicTenantDto(tenant) : null;
    }
}
