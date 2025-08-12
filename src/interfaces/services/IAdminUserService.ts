import { AdminUserDto } from "../../dtos/user.dto";

export interface IAdminUserService {
    list(): Promise<AdminUserDto[]>;
}
