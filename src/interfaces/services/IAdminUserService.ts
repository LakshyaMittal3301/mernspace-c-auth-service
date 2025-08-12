import { AdminViewUserDto, CreateAdminUserDto, CreateManagerUserDto } from "../../dtos/user.dto";
import { User } from "../../entity/User";

export interface IAdminUserService {
    list(): Promise<AdminViewUserDto[]>;
    createAdmin(dto: CreateAdminUserDto): Promise<AdminViewUserDto>;
    createManager(dto: CreateManagerUserDto): Promise<AdminViewUserDto>;
    getById(id: number): Promise<AdminViewUserDto | null>;
}
