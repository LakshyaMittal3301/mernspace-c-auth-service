import { Roles } from "../constants";

export type SelfExpand = "tenant";
export const ALLOWED_SELF_EXPANDS: readonly SelfExpand[] = ["tenant"] as const;
export const isSelfExpand = (v: string): v is SelfExpand => (ALLOWED_SELF_EXPANDS as string[]).includes(v);

export const SELF_EXPAND_TO_ROLE_MAP: Record<SelfExpand, string[]> = {
    tenant: [Roles.MANAGER, Roles.ADMIN],
};
