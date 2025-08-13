// tests/tenants/get-tenant-by-id.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("GET /tenants/:id", () => {
    const route = (id: string | number) => `/tenants/${id}`;
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    let admin: User;
    let adminAccessToken: string;

    const makeTokenFor = (user: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        // MUST match Config.JWKS_URI in test env
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await clearAllTablesExceptMigrations(connection);

        admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        adminAccessToken = makeTokenFor(admin);
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    const seedTenant = async (overrides?: Partial<Tenant>) => {
        const repo = connection.getRepository(Tenant);
        const t = repo.create({
            name: "Acme Corp",
            address: "1 Main St",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            ...overrides,
        });
        return repo.save(t);
    };

    describe("Happy path", () => {
        it("returns 200 and the tenant DTO by id", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .get(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
            expect(res.body).toHaveProperty("tenant");

            const tenant = res.body.tenant;
            expect(tenant).toEqual(
                expect.objectContaining({
                    name: "Acme Corp",
                    address: "1 Main St",
                }),
            );
            expect(typeof tenant.createdAt).toBe("string");
            expect(Number.isNaN(Date.parse(tenant.createdAt))).toBe(false);
        });

        it("does not mutate the database", async () => {
            const t = await seedTenant();
            const before = await connection.getRepository(Tenant).count();

            await request(app)
                .get(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send()
                .expect(200);

            const after = await connection.getRepository(Tenant).count();
            expect(after).toBe(before);
        });
    });

    describe("Not found / invalid input", () => {
        it("404 when tenant does not exist", async () => {
            const res = await request(app)
                .get(route(9999))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(404);
        });

        it("400 when id is not a number", async () => {
            const res = await request(app)
                .get(route("abc"))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(400);
        });

        it("handles whitespace id (Number() trims) -> valid and returns 200", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .get(route(`  ${t.id}  `))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body.tenant.name).toBe("Acme Corp");
        });

        it("404 for numeric but non-existing id (e.g., 0)", async () => {
            const res = await request(app)
                .get(route(0))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(404);
        });
    });

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).get(route(1)).send();
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app).get(route(1)).set("Cookie", ["accessToken=not-a-jwt"]).send();

            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const expired = makeTokenFor(admin, { exp: Math.floor(Date.now() / 1000) - 10 });

            const res = await request(app)
                .get(route(1))
                .set("Cookie", [`accessToken=${expired}`])
                .send();

            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin calls the route", async () => {
            const manager = await createUser(connection, {
                firstName: "Mgr",
                lastName: "User",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const managerToken = makeTokenFor(manager);

            const t = await seedTenant();

            const res = await request(app)
                .get(route(t.id))
                .set("Cookie", [`accessToken=${managerToken}`])
                .send();

            expect(res.statusCode).toBe(403);
        });

        it("403 when role claim is unsupported", async () => {
            const weird = await createUser(connection, {
                firstName: "Weird",
                lastName: "Role",
                email: "weird@example.com",
                password: "Weird@123",
                role: "weird-role" as any,
            });
            const weirdToken = jwks.token({ sub: String(weird.id), role: "weird-role" });

            const t = await seedTenant();

            const res = await request(app)
                .get(route(t.id))
                .set("Cookie", [`accessToken=${weirdToken}`])
                .send();

            expect(res.statusCode).toBe(403);
        });
    });

    describe("Response shape", () => {
        it("exposes only public fields (id, name, address, createdAt) by default", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .get(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            const tenant = res.body.tenant;
            expect(Object.keys(tenant).sort()).toEqual(["address", "createdAt", "id", "name"].sort());
        });
    });
});
