import { RegisterDto, AuthResult, LoginDto, RefreshDto, TokenPair, LogoutDto } from "../../dtos/auth.dto";
import { PublicUserDto } from "../../dtos/user.dto";

export interface IAuthService {
    register(registerDto: RegisterDto): Promise<AuthResult>;
    login(loginDto: LoginDto): Promise<AuthResult>;
    whoAmI(userId: number): Promise<PublicUserDto>;
    refresh(refreshDto: RefreshDto): Promise<TokenPair>;
    logout(logoutDto: LogoutDto): Promise<void>;
}
