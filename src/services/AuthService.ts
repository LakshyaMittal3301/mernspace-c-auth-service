import { Logger } from "winston";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { ITokenService } from "../interfaces/services/ITokenService";
import { IUserService } from "../interfaces/services/IUserService";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import { IAuthService } from "../interfaces/services/IAuthService";
import { toPublicUserDto } from "../mappers/user.mapper";
import { RegisterDto, AuthResult, LoginDto, RefreshDto, TokenPair } from "../dtos/auth.dto";
import { PublicUserDto } from "../dtos/user.dto";
import { AppClaims } from "../types/claims";
import { toAuthResult, toTokenPair } from "../mappers/auth.mapper";

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
        const payload: AppClaims = {
            sub: String(user.id),
            role: user.role,
        };

        return toAuthResult(user, await this.getAccessAndRefreshTokens(payload, user.id));
    }

    async login(loginDto: LoginDto): Promise<AuthResult> {
        const { email, password } = loginDto;

        const user = await this.userService.findByEmail(email);
        if (user === null || !(await this.passwordService.comparePassword(password, user.password))) {
            throw new InvalidCredentialsError();
        }

        const payload: AppClaims = {
            sub: String(user.id),
            role: user.role,
        };

        return toAuthResult(user, await this.getAccessAndRefreshTokens(payload, user.id));
    }

    async whoAmI(userId: number): Promise<PublicUserDto> {
        const user = await this.userService.findById(userId);
        return toPublicUserDto(user);
    }

    async refresh(refreshDto: RefreshDto): Promise<TokenPair> {
        const payload = refreshDto.payload;
        const userId = payload.sub;
        return this.getAccessAndRefreshTokens(payload, Number(userId));
    }

    private async getAccessAndRefreshTokens(payload: AppClaims, userId: number): Promise<TokenPair> {
        const accessToken = this.tokenService.generateAccessToken(payload);
        const refreshToken = await this.tokenService.generateRefreshToken(payload, userId);

        return toTokenPair(accessToken, refreshToken);
    }
}
