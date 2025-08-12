import { Repository } from "typeorm";
import { CreateTenantDto, PublicTenantDto, UpdateTenantDto } from "../dtos/tenant.dto";
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

    async update(id: number, updateTenantDto: UpdateTenantDto): Promise<PublicTenantDto | null> {
        const tenant = await this.tenantRepository.findOne({ where: { id } });
        if (!tenant) return null;

        if (updateTenantDto.name !== undefined) tenant.name = updateTenantDto.name;
        if (updateTenantDto.address !== undefined) tenant.address = updateTenantDto.address;

        const saved = await this.tenantRepository.save(tenant);
        return toPublicTenantDto(saved);
    }

    async delete(id: number): Promise<void> {
        await this.tenantRepository.delete({ id });
    }
}
