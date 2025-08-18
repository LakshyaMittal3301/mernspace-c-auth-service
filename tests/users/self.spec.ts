import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { clearAllTablesExceptMigrations, createUserWithHashedPassword } from "../utils";
import { Roles } from "../../src/constants";
import { Tenant } from "../../src/entity/Tenant";

describe("GET /auth/self", () => {
    const selfRoute = "/auth/self";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeTokenFor =
        (jwks: JWKSMock) =>
        (user: any, extra: Record<string, any> = {}) =>
            jwks.token({ sub: String(user.id), role: user.role, ...extra });

    const seedTenant = async (connection: DataSource, overrides?: Partial<Tenant>) => {
        const repo = connection.getRepository(Tenant);
        const t = repo.create({
            name: "Pizza Planet",
            address: "Sector 7G",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            ...overrides,
        });
        return repo.save(t);
    };

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await clearAllTablesExceptMigrations(connection);
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    describe("All fields are present", () => {
        const userData = {
            firstName: "lakshya",
            lastName: "mittal",
            email: "lakshya@gmail.com",
            password: "lakshya@123",
        };

        it("should return 200 status code", async () => {
            const newUser = await createUserWithHashedPassword(connection, userData);

            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();
            expect(response.statusCode).toBe(200);
        });

        it("should return the user data", async () => {
            // Insert a User
            const newUser = await createUserWithHashedPassword(connection, userData);

            // Generate Token
            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();

            // Check if user id matches with registered user
            expect(response.body).toHaveProperty("id");
            expect(response.body.id).toBe(newUser.id);
        });

        it("should not return the password in the user data", async () => {
            const newUser = await createUserWithHashedPassword(connection, userData);

            // Generate Token
            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();

            // Check if user id matches with registered user
            expect(response.body).not.toHaveProperty("password");
        });

        it("should return 401 status code when token is not present", async () => {
            const response = await request(app).get(selfRoute).send();

            expect(response.statusCode).toBe(401);
        });
    });

    // ADD after your existing "describe('All fields are present', ...)"
    describe("expand=tenant behavior", () => {
        const selfRoute = "/auth/self";

        it("1) no expand → no tenant field (even for manager)", async () => {
            const t = await seedTenant(connection);
            const manager = await createUserWithHashedPassword(connection, {
                firstName: "Mgr",
                lastName: "One",
                email: "mgr1@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
                tenantId: t.id,
            });

            const token = makeTokenFor(jwks)(manager);

            const res = await request(app)
                .get(selfRoute) // no expand
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).not.toHaveProperty("tenant");
        });

        it("2) expand without tenant (e.g., permissions) → ignore and return only user", async () => {
            const t = await seedTenant(connection);
            const manager = await createUserWithHashedPassword(connection, {
                firstName: "Mgr",
                lastName: "Two",
                email: "mgr2@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
                tenantId: t.id,
            });

            const token = makeTokenFor(jwks)(manager);

            const res = await request(app)
                .get(`${selfRoute}?expand=permissions`) // no 'tenant' in expand
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("id", manager.id);
            expect(res.body).not.toHaveProperty("tenant");
        });

        it("3a) expand includes tenant at START → include tenant for manager", async () => {
            const t = await seedTenant(connection, { name: "Tenant A" });
            const manager = await createUserWithHashedPassword(connection, {
                firstName: "Mgr",
                lastName: "Three",
                email: "mgr3@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
                tenantId: t.id,
            });

            const token = makeTokenFor(jwks)(manager);

            const res = await request(app)
                .get(`${selfRoute}?expand=tenant,permissions`)
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("tenant");
            // be lenient about shape; at least id should match
            expect(res.body.tenant).toEqual(expect.objectContaining({ id: t.id }));
        });

        it("3b) expand includes tenant at END → include tenant for manager", async () => {
            const t = await seedTenant(connection, { name: "Tenant B" });
            const manager = await createUserWithHashedPassword(connection, {
                firstName: "Mgr",
                lastName: "Four",
                email: "mgr4@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
                tenantId: t.id,
            });

            const token = makeTokenFor(jwks)(manager);

            const res = await request(app)
                .get(`${selfRoute}?expand=permissions,tenant`)
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("tenant");
            expect(res.body.tenant).toEqual(expect.objectContaining({ id: t.id }));
        });

        it("4a) admin + expand contains tenant → tenant present but null", async () => {
            const admin = await createUserWithHashedPassword(connection, {
                firstName: "Admin",
                lastName: "One",
                email: "admin1@example.com",
                password: "Admin@123",
                role: Roles.ADMIN,
            });

            const token = makeTokenFor(jwks)(admin);

            const res = await request(app)
                .get(`${selfRoute}?expand=tenant`)
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("tenant", null);
        });

        it("4b) customer + expand contains tenant → tenant field NOT present", async () => {
            const customer = await createUserWithHashedPassword(connection, {
                firstName: "Cust",
                lastName: "One",
                email: "cust1@example.com",
                password: "Customer@123",
                role: Roles.CUSTOMER,
            });

            const token = makeTokenFor(jwks)(customer);

            const res = await request(app)
                .get(`${selfRoute}?expand=permissions,tenant`)
                .set("Cookie", [`accessToken=${token}`])
                .send();

            expect(res.statusCode).toBe(200);
            expect(res.body).not.toHaveProperty("tenant");
        });
    });
});
