import { Logger } from "winston";
import {
    AuthResult,
    IAuthService,
    LoginDto,
    PublicUserDto,
    RegisterDto,
    toPublicUserDto,
} from "../interfaces/services/IAuthService";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { TokenPayload, ITokenService } from "../interfaces/services/ITokenService";
import { IUserService } from "../interfaces/services/IUserService";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import { User } from "../entity/User";

export default class AuthService implements IAuthService {
    constructor(
        private logger: Logger,
        private userService: IUserService,
        private passwordService: IPasswordService,
        private tokenService: ITokenService,
    ) {}

    async register(registerDto: RegisterDto): Promise<AuthResult> {
        const { firstName, lastName, email, password } = registerDto;

        // Hashing Password
        const hashedPassword = await this.passwordService.hashPassword(password);

        // Saving user
        const user = await this.userService.createWithHash({
            firstName,
            lastName,
            email,
            hashedPassword,
        });
        this.logger.info(`User created successfully`, { id: user.id });

        // Get Access Token and Refresh Token
        const payload: TokenPayload = {
            sub: String(user.id),
            role: user.role,
        };

        const accessToken = this.tokenService.generateAccessToken(payload);
        const refreshToken = await this.tokenService.generateRefreshToken(payload, user.id);

        const authResult: AuthResult = {
            user: toPublicUserDto(user),
            tokens: {
                accessToken,
                refreshToken,
            },
        };

        return authResult;
    }

    async login(loginDto: LoginDto): Promise<AuthResult> {
        const { email, password } = loginDto;

        const user = await this.userService.findByEmail(email);
        if (user === null || !(await this.passwordService.comparePassword(password, user.password))) {
            throw new InvalidCredentialsError();
        }

        const payload: TokenPayload = {
            sub: String(user.id),
            role: user.role,
        };

        const accessToken = this.tokenService.generateAccessToken(payload);
        const refreshToken = await this.tokenService.generateRefreshToken(payload, user.id);

        return {
            user: toPublicUserDto(user),
            tokens: {
                accessToken,
                refreshToken,
            },
        };
    }

    async findUserById(userId: number): Promise<PublicUserDto> {
        const user = await this.userService.findById(userId);
        return toPublicUserDto(user);
    }
}
