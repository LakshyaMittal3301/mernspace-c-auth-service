// tests/tenants/get-all-tenants.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("GET /tenants", () => {
    const getTenantsRoute = "/tenants";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    let admin: User;
    let adminAccessToken: string;

    const makeTokenFor = (user: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        // MUST match Config.JWKS_URI in test env
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await connection.dropDatabase();

        // Admin user + token
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

    const seedTenants = async (items: Array<Partial<Tenant>>) => {
        const repo = connection.getRepository(Tenant);
        const entities = items.map((i) => repo.create(i));
        await repo.save(entities);
        return repo.find({ order: { createdAt: "ASC" } });
    };

    describe("Happy path", () => {
        it("returns 200 and JSON with tenants array (empty list)", async () => {
            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
            expect(res.body).toHaveProperty("tenants");
            expect(Array.isArray(res.body.tenants)).toBe(true);
            expect(res.body.tenants).toHaveLength(0);
        });

        it("returns tenants with expected DTO fields and ISO createdAt", async () => {
            await seedTenants([{ name: "T1", address: "A1", createdAt: new Date("2025-01-01T00:00:00.000Z") }]);

            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body.tenants).toHaveLength(1);

            const t = res.body.tenants[0];
            expect(t).toEqual(
                expect.objectContaining({
                    name: "T1",
                    address: "A1",
                }),
            );
            expect(typeof t.createdAt).toBe("string");
            expect(Number.isNaN(Date.parse(t.createdAt))).toBe(false); // valid ISO-ish date
        });

        it("orders tenants by createdAt ASC (oldest first)", async () => {
            await seedTenants([
                { name: "Old", address: "A", createdAt: new Date("2025-01-01T00:00:00.000Z") },
                { name: "Mid", address: "B", createdAt: new Date("2025-03-01T00:00:00.000Z") },
                { name: "New", address: "C", createdAt: new Date("2025-05-01T00:00:00.000Z") },
            ]);

            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            const names = res.body.tenants.map((t: any) => t.name);
            expect(names).toEqual(["Old", "Mid", "New"]);
        });

        it("does not mutate the database (read-only route)", async () => {
            const before = await connection.getRepository(Tenant).count();

            await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send()
                .expect(200);

            const after = await connection.getRepository(Tenant).count();
            expect(after).toBe(before);
        });
    });

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated (no access token)", async () => {
            const res = await request(app).get(getTenantsRoute).send();
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app).get(getTenantsRoute).set("Cookie", ["accessToken=not-a-jwt"]).send();
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const expiredToken = makeTokenFor(admin, { exp: Math.floor(Date.now() / 1000) - 5 });
            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${expiredToken}`])
                .send();
            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin tries to access", async () => {
            const manager = await createUser(connection, {
                firstName: "Mgr",
                lastName: "User",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const managerToken = makeTokenFor(manager);

            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${managerToken}`])
                .send();

            expect(res.statusCode).toBe(403);
        });

        it("403 when role claim is unknown/unsupported", async () => {
            const weird = await createUser(connection, {
                firstName: "Weird",
                lastName: "Role",
                email: "weird@example.com",
                password: "Weird@123",
                role: "weird-role" as any,
            });
            const weirdToken = jwks.token({ sub: String(weird.id), role: "weird-role" });

            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${weirdToken}`])
                .send();

            expect(res.statusCode).toBe(403);
        });
    });

    describe("Response shape invariants", () => {
        it("returns only public DTO fields (id, name, address, createdAt) per tenant", async () => {
            await seedTenants([{ name: "OnlyPublic", address: "Addr", createdAt: new Date() }]);

            const res = await request(app)
                .get(getTenantsRoute)
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(200);
            const t = res.body.tenants[0];
            // Ensure no unexpected fields leak (adjust if you decide to expose id)
            expect(Object.keys(t).sort()).toEqual(["address", "createdAt", "id", "name"].sort());
        });
    });
});
