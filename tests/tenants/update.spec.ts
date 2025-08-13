// tests/tenants/update-tenant.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("PATCH /tenants/:id", () => {
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
            name: "Orig Name",
            address: "Orig Address",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            ...overrides,
        });
        return repo.save(t);
    };

    describe("Happy path", () => {
        it("updates a single field (address) and returns 200 with DTO", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ address: "New Address" });

            expect(res.statusCode).toBe(200);
            expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
            expect(res.body).toHaveProperty("tenant");
            expect(res.body.tenant).toEqual(
                expect.objectContaining({
                    name: "Orig Name", // unchanged
                    address: "New Address",
                }),
            );
            expect(typeof res.body.tenant.createdAt).toBe("string");

            const saved = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });
            expect(saved.name).toBe("Orig Name");
            expect(saved.address).toBe("New Address");
        });

        it("updates multiple fields", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ name: "New Name", address: "New Addr" });

            expect(res.statusCode).toBe(200);
            expect(res.body.tenant.name).toBe("New Name");
            expect(res.body.tenant.address).toBe("New Addr");
        });

        it("trims fields if validator has trim enabled", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ name: "   New N   ", address: "  New A  " });

            expect(res.statusCode).toBe(200);
            // depending on your mapper/validator, values should be trimmed
            const repo = connection.getRepository(Tenant);
            const saved = await repo.findOneByOrFail({ id: t.id });
            expect(saved.name).toBe("New N");
            expect(saved.address).toBe("New A");
        });
    });

    describe("Validation (length/format via update validator)", () => {
        it("accepts boundary lengths: name=100, address=255", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ name: "x".repeat(100), address: "y".repeat(255) });

            expect(res.statusCode).toBe(200);
            const saved = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });
            expect(saved.name).toBe("x".repeat(100));
            expect(saved.address).toBe("y".repeat(255));
        });

        it("400 when name > 100", async () => {
            const t = await seedTenant();
            const before = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ name: "x".repeat(101) });

            expect(res.statusCode).toBe(400);

            const after = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });
            expect(after.name).toBe(before.name); // unchanged
        });

        it("400 when address > 255", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ address: "y".repeat(256) });

            expect(res.statusCode).toBe(400);
        });

        it("400 when provided field is empty string (notEmpty)", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ name: "" });

            expect(res.statusCode).toBe(400);
        });
    });

    describe("Controller-only check for empty body", () => {
        it("400 when no update fields provided (controller throws)", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({}); // empty body

            expect(res.statusCode).toBe(400);

            const saved = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });
            expect(saved.name).toBe("Orig Name"); // unchanged
            expect(saved.address).toBe("Orig Address");
        });
    });

    describe("Invalid id / Not found", () => {
        it("400 when id is not a number", async () => {
            const res = await request(app)
                .patch(route("abc"))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ address: "X" });

            expect(res.statusCode).toBe(400);
        });

        it("404 when tenant does not exist", async () => {
            const res = await request(app)
                .patch(route(9999))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ address: "X" });

            expect(res.statusCode).toBe(404);
        });
    });

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).patch(route(1)).send({ address: "X" });
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app)
                .patch(route(1))
                .set("Cookie", ["accessToken=not-a-jwt"])
                .send({ address: "X" });

            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const expired = makeTokenFor(admin, { exp: Math.floor(Date.now() / 1000) - 10 });

            const res = await request(app)
                .patch(route(1))
                .set("Cookie", [`accessToken=${expired}`])
                .send({ address: "X" });

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
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${managerToken}`])
                .send({ address: "New Addr" });

            expect(res.statusCode).toBe(403);
        });
    });

    describe("Invariants / disallowed fields", () => {
        it("does not create a new tenant (only updates existing)", async () => {
            const before = await connection.getRepository(Tenant).count();
            await connection
                .getRepository(Tenant)
                .save(connection.getRepository(Tenant).create({ name: "OnlyOne", address: "OnlyOneAddr" }));

            await request(app)
                .patch(route(1))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({ address: "Changed" })
                .expect([200, 404]); // 200 if id 1 exists, 404 if not — adjust if you set explicit ids

            const after = await connection.getRepository(Tenant).count();
            expect(after).toBe(before + 1); // count unchanged besides the seeded one
        });

        it("ignores disallowed fields (e.g., createdAt, id) and keeps createdAt stable", async () => {
            const t = await seedTenant();
            const originalCreatedAt = t.createdAt.getTime();

            const res = await request(app)
                .patch(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send({
                    name: "Updated",
                    createdAt: "1999-01-01T00:00:00.000Z",
                    id: 9999,
                } as any);

            expect(res.statusCode).toBe(200);

            const saved = await connection.getRepository(Tenant).findOneByOrFail({ id: t.id });
            expect(saved.name).toBe("Updated");
            expect(saved.id).toBe(t.id); // unchanged
            expect(saved.createdAt.getTime()).toBe(originalCreatedAt); // unchanged
        });
    });
});
