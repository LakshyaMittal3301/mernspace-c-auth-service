import { Repository } from "typeorm";
import { AdminUserDto } from "../dtos/user.dto";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";
import { User } from "../entity/User";
import { buildAdminUserDto } from "../mappers/user.mapper";

export default class AdminUserService implements IAdminUserService {
    constructor(private userReposity: Repository<User>) {}

    async list(): Promise<AdminUserDto[]> {
        const users = await this.userReposity.find();
        return users.map(buildAdminUserDto);
    }
}
