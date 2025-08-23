import { Logger } from "winston";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { ITokenService } from "../interfaces/services/ITokenService";
import { IUserService } from "../interfaces/services/IUserService";
import { InvalidCredentialsError } from "../errors/InvalidCredentialsError";
import { IAuthService } from "../interfaces/services/IAuthService";
import { buildPublicUserDto } from "../mappers/user.mapper";
import { RegisterDto, AuthResult, LoginDto, RefreshDto, TokenPair, LogoutDto, SelfDto } from "../dtos/auth.dto";
import { buildAccessTokenClaims, buildAuthResult, buildTokenPair } from "../mappers/auth.mapper";
import { UserNotFoundError } from "../errors/UserNotFoundError";
import { SELF_EXPAND_TO_ROLE_MAP, SelfExpand } from "../types/expand";
import { ITenantService } from "../interfaces/services/ITenantService";
import { User } from "../entity/User";

export default class AuthService implements IAuthService {
    constructor(
        private logger: Logger,
        private userService: IUserService,
        private passwordService: IPasswordService,
        private tokenService: ITokenService,
        private tenantService: ITenantService,
    ) {}

    async register(registerDto: RegisterDto): Promise<AuthResult> {
        const { firstName, lastName, email, password } = registerDto;

        const hashedPassword = await this.passwordService.hashPassword(password);

        const user = await this.userService.createWithHash({
            firstName,
            lastName,
            email,
            hashedPassword,
        });
        this.logger.info(`User created successfully`, { id: user.id });

        const tokens = await this.getAccessAndRefreshTokens(user);
        return buildAuthResult(user, tokens);
    }

    async login(loginDto: LoginDto): Promise<AuthResult> {
        const { email, password } = loginDto;

        const user = await this.userService.findByEmail(email);
        if (!user || !(await this.passwordService.comparePassword(password, user.password))) {
            throw new InvalidCredentialsError();
        }
        const tokens = await this.getAccessAndRefreshTokens(user);
        return buildAuthResult(user, tokens);
    }

    async self(userId: number, expands: SelfExpand[]): Promise<SelfDto> {
        const user = await this.userService.findById(userId);
        if (!user) throw new UserNotFoundError();

        const publicUserDto = buildPublicUserDto(user);
        const dto: SelfDto = { ...publicUserDto };

        const wantsTenant = expands.includes("tenant");
        if (wantsTenant && SELF_EXPAND_TO_ROLE_MAP["tenant"].includes(dto.role)) {
            dto.tenant = user.tenantId ? await this.tenantService.getById(user.tenantId) : null;
        }
        return dto;
    }

    async refresh({ userId, refreshTokenId }: RefreshDto): Promise<TokenPair> {
        await this.tokenService.revokeRefreshToken(refreshTokenId);

        const user = await this.userService.findById(userId);
        if (!user) throw new UserNotFoundError();
        return this.getAccessAndRefreshTokens(user);
    }

    async logout(logoutDto: LogoutDto): Promise<void> {
        const { refreshTokenId } = logoutDto;
        await this.tokenService.revokeRefreshToken(refreshTokenId);
    }

    private async getAccessAndRefreshTokens(user: User): Promise<TokenPair> {
        const tenantId = user.tenantId ?? undefined;

        const accessTokenClaims = buildAccessTokenClaims(user.id, user.role, tenantId);
        try {
            const accessToken = this.tokenService.generateAccessToken(accessTokenClaims);
            const refreshToken = await this.tokenService.generateRefreshToken(user.id);
            return buildTokenPair(accessToken, refreshToken);
        } catch (err) {
            this.logger.error("Error generating access and/or refresh token", { error: err });
            throw err;
        }
    }
}
