import { RegisterDto, AuthResult, LoginDto, RefreshDto, TokenPair, LogoutDto, SelfDto } from "../../dtos/auth.dto";
import { PublicUserDto } from "../../dtos/user.dto";
import { SelfExpand } from "../../types/expand";

export interface IAuthService {
    register(registerDto: RegisterDto): Promise<AuthResult>;
    login(loginDto: LoginDto): Promise<AuthResult>;
    self(userId: number, expands: SelfExpand[]): Promise<SelfDto>;
    refresh(refreshDto: RefreshDto): Promise<TokenPair>;
    logout(logoutDto: LogoutDto): Promise<void>;
}
