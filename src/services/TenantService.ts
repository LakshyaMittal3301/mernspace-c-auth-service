import { Repository } from "typeorm";
import { CreateTenantDto } from "../dtos/tenant.dto";
import { Tenant } from "../entity/Tenant";
import { ITenantService } from "../interfaces/services/ITenantService";

export default class TenantService implements ITenantService {
    constructor(private tenantRepository: Repository<Tenant>) {}

    async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
        const { name, address } = createTenantDto;
        return await this.tenantRepository.save({ name, address });
    }
}
