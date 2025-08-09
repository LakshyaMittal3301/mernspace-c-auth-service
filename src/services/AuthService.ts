import { Logger } from "winston";
import { User } from "../entity/User";
import IAuthService from "../interfaces/services/IAuthService";
import IPasswordService from "../interfaces/services/IPasswordService";
import ITokenService from "../interfaces/services/ITokenService";
import IUserService from "../interfaces/services/IUserService";
import { UserData } from "../types";
import { JwtPayload } from "jsonwebtoken";

export default class AuthService implements IAuthService {
    constructor(
        private logger: Logger,
        private userService: IUserService,
        private passwordService: IPasswordService,
        private tokenService: ITokenService,
    ) {}

    async register(registerData: UserData): Promise<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
    }> {
        const { firstName, lastName, email, password } = registerData;

        // Hashing Password
        const hashedPassword =
            await this.passwordService.hashPassword(password);

        // Saving user
        const user = await this.userService.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
        });
        this.logger.info(`User created successfully`, { id: user.id });

        // Get Access Token and Refresh Token
        const payload: JwtPayload = {
            sub: String(user.id),
            role: user.role,
        };

        const accessToken = this.tokenService.generateAccessToken(payload);

        const refreshToken = await this.tokenService.generateRefreshToken(
            payload,
            user,
        );

        return {
            user,
            tokens: {
                accessToken,
                refreshToken,
            },
        };
    }
}
