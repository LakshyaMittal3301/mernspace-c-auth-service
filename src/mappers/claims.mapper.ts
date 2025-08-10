import { RefreshDto } from "../dtos/auth.dto";
import { AppClaims, FullJwtClaims } from "../types/claims";

export const toAppClaims = (fullJwtClaims: FullJwtClaims): AppClaims => {
    const { sub, role } = fullJwtClaims;
    return { sub, role };
};

export const toRefreshDto = (fullJwtClaims: FullJwtClaims): RefreshDto => {
    return {
        payload: toAppClaims(fullJwtClaims),
    };
};
