import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("POST /tenants", () => {
    const createTenantRoute = "/tenants";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;
    let adminUser: User;
    let adminUserAccessToken: string;

    const makeTokenFor = (user: User, extraClaims: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extraClaims });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();

        await clearAllTablesExceptMigrations(connection);

        const adminData = {
            firstName: "lakshya",
            lastName: "mittal",
            email: "lakshya@gmail.com",
            password: "password@123",
            role: Roles.ADMIN,
        };

        adminUser = await createUser(connection, adminData);
        adminUserAccessToken = makeTokenFor(adminUser);
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    describe("Happy path", () => {
        const tenantData = {
            name: "Tenant name",
            address: "Tenant address",
        };

        it("returns 201 and JSON with id", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send(tenantData);

            expect(res.statusCode).toBe(201);
            expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
            expect(res.body).toHaveProperty("id");
            expect(typeof res.body.id).toBe("number");
        });

        it("persists a tenant with the provided fields", async () => {
            await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send(tenantData);

            const repo = connection.getRepository(Tenant);
            const tenants = await repo.find();
            expect(tenants).toHaveLength(1);
            expect(tenants[0].name).toBe(tenantData.name);
            expect(tenants[0].address).toBe(tenantData.address);
        });
    });

    describe("Validation errors", () => {
        it("400 when name is missing", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ address: "addr" });

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("400 when address is missing", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ name: "name" });

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("accepts boundary lengths: name=100, address=255", async () => {
            const name100 = "x".repeat(100);
            const address255 = "y".repeat(255);

            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ name: name100, address: address255 });

            expect(res.statusCode).toBe(201);

            const repo = connection.getRepository(Tenant);
            const t = await repo.find();
            expect(t).toHaveLength(1);
            expect(t[0].name).toBe(name100);
            expect(t[0].address).toBe(address255);
        });

        it("400 when name > 100 chars", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ name: "x".repeat(101), address: "ok" });

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("400 when address > 255 chars", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ name: "ok", address: "y".repeat(256) });

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("400 on empty strings (notEmpty validator)", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send({ name: "", address: "" });

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });
    });

    describe("Auth / RBAC", () => {
        const tenantData = { name: "T", address: "A" };

        it("401 when user is not authenticated (no cookies)", async () => {
            const res = await request(app).post(createTenantRoute).send(tenantData);
            expect(res.statusCode).toBe(401);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("401 when access token is clearly invalid", async () => {
            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", ["accessToken=not-a-jwt"])
                .send(tenantData);

            expect(res.statusCode).toBe(401);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("401 when access token is expired", async () => {
            // exp in the past
            const expiredToken = makeTokenFor(adminUser, { exp: Math.floor(Date.now() / 1000) - 10 });

            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${expiredToken}`])
                .send(tenantData);

            expect(res.statusCode).toBe(401);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("403 when user is not admin", async () => {
            const manager = await createUser(connection, {
                firstName: "m",
                lastName: "n",
                email: "m1@gmail.com",
                password: "password@123",
                role: Roles.MANAGER,
            });
            const managerToken = makeTokenFor(manager);

            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${managerToken}`])
                .send(tenantData);

            expect(res.statusCode).toBe(403);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("403 when role claim is present but not in allowed list", async () => {
            // Simulate a weird/unknown role in the JWT
            const weirdRoleUser = await createUser(connection, {
                firstName: "w",
                lastName: "r",
                email: "weird@gmail.com",
                password: "password@123",
                role: "weird-role" as any,
            });

            const weirdToken = jwks.token({ sub: String(weirdRoleUser.id), role: "weird-role" });

            const res = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${weirdToken}`])
                .send(tenantData);

            expect(res.statusCode).toBe(403);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });
    });

    describe("Idempotency / invariants", () => {
        it("does not create a tenant on validation error", async () => {
            const bad = { name: "x".repeat(101), address: "ok" };

            await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send(bad)
                .expect(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("does not create a tenant when unauthorized", async () => {
            await request(app).post(createTenantRoute).send({ name: "T", address: "A" }).expect(401);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });
    });
});
