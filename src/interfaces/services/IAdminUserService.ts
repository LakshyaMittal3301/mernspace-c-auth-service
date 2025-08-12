import { AdminViewUserDto, CreateAdminUserDto, CreateManagerUserDto, UpdateUserDto } from "../../dtos/user.dto";

export interface IAdminUserService {
    list(): Promise<AdminViewUserDto[]>;
    createAdmin(dto: CreateAdminUserDto): Promise<AdminViewUserDto>;
    createManager(dto: CreateManagerUserDto): Promise<AdminViewUserDto>;
    getById(id: number): Promise<AdminViewUserDto | null>;
    update(id: number, dto: UpdateUserDto): Promise<AdminViewUserDto | null>;
    delete(id: number): Promise<void>;
}
