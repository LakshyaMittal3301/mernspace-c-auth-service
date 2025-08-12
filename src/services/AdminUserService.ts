import { Repository } from "typeorm";
import { AdminViewUserDto, CreateAdminUserDto } from "../dtos/user.dto";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";
import { User } from "../entity/User";
import { buildAdminViewUserDto } from "../mappers/user.mapper";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { Roles } from "../constants";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";

export default class AdminUserService implements IAdminUserService {
    constructor(
        private userRepository: Repository<User>,
        private passwordService: IPasswordService,
    ) {}

    async list(): Promise<AdminViewUserDto[]> {
        const users = await this.userRepository.find();
        return users.map(buildAdminViewUserDto);
    }

    async createAdmin(dto: CreateAdminUserDto): Promise<AdminViewUserDto> {
        const { firstName, lastName, email, password } = dto;

        const existingUser = await this.userRepository.findOne({ where: { email: email } });
        if (existingUser) throw new UserAlreadyExistsError(email);

        const hashedPassword = await this.passwordService.hashPassword(password);

        const user = await this.userRepository.save({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: Roles.ADMIN,
        });

        return buildAdminViewUserDto(user);
    }
}
