export class TenantNotFoundError extends Error {
    constructor(tenantId: string) {
        super(`Tenant not found with id: ${tenantId}`);
        this.name = "TenantNotFoundError";
    }
}
