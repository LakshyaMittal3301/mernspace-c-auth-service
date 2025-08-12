import { AdminViewUserDto, CreateAdminUserDto } from "../../dtos/user.dto";
import { User } from "../../entity/User";

export interface IAdminUserService {
    list(): Promise<AdminViewUserDto[]>;
    createAdmin(dto: CreateAdminUserDto): Promise<AdminViewUserDto>;
}
