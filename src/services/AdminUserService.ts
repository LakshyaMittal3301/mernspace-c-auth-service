import { Repository } from "typeorm";
import { AdminViewUserDto, CreateAdminUserDto, CreateManagerUserDto, UpdateUserDto } from "../dtos/user.dto";
import { IAdminUserService } from "../interfaces/services/IAdminUserService";
import { User } from "../entity/User";
import { buildAdminViewUserDto } from "../mappers/user.mapper";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { Roles } from "../constants";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { TenantNotFoundError } from "../errors/TenantNotFoundError";
import { Tenant } from "../entity/Tenant";

export default class AdminUserService implements IAdminUserService {
    constructor(
        private userRepository: Repository<User>,
        private tenantRepository: Repository<Tenant>,
        private passwordService: IPasswordService,
    ) {}

    async list(): Promise<AdminViewUserDto[]> {
        const users = await this.userRepository.find();
        return users.map(buildAdminViewUserDto);
    }

    async createAdmin(dto: CreateAdminUserDto): Promise<AdminViewUserDto> {
        const email = dto.email.trim().toLowerCase();
        const { firstName, lastName, password } = dto;

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

    async createManager(dto: CreateManagerUserDto): Promise<AdminViewUserDto> {
        const email = dto.email.trim().toLowerCase();
        const { firstName, lastName, password, tenantId } = dto;

        const [emailTaken, tenantExists] = await Promise.all([
            this.userRepository.exists({ where: { email } }),
            this.tenantRepository.exists({ where: { id: tenantId } }),
        ]);

        if (emailTaken) throw new UserAlreadyExistsError(email);
        if (!tenantExists) throw new TenantNotFoundError(String(tenantId));

        const hashed = await this.passwordService.hashPassword(password);

        const user = await this.userRepository.save({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email,
            password: hashed,
            role: Roles.MANAGER,
            tenantId,
        });

        return buildAdminViewUserDto(user);
    }

    async getById(id: number): Promise<AdminViewUserDto | null> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) return null;
        return buildAdminViewUserDto(user);
    }

    async update(id: number, dto: UpdateUserDto): Promise<AdminViewUserDto | null> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) return null;

        const email = dto.email?.trim().toLowerCase();
        const { firstName, lastName, password, tenantId } = dto;

        if (email !== undefined && user.email !== email) {
            if (await this.userRepository.exists({ where: { email } })) {
                throw new UserAlreadyExistsError(email);
            }
            user.email = email;
        }
        if (tenantId !== undefined) {
            if (!(await this.tenantRepository.exists({ where: { id: tenantId } }))) {
                throw new TenantNotFoundError(String(tenantId));
            }
            user.tenantId = tenantId;
        }
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (password !== undefined) {
            const hashedPassword = await this.passwordService.hashPassword(password);
            user.password = hashedPassword;
        }

        const saved = await this.userRepository.save(user);
        return buildAdminViewUserDto(saved);
    }
}
