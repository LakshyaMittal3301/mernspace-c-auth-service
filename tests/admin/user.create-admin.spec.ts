// tests/admin/users.create-admin.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import request from "supertest";
import app from "../../src/app";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { User } from "../../src/entity/User";

describe("POST /admin/users/admins", () => {
    const route = "/admin/users/admins";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (u: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(u.id), role: u.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        jwks = createJWKSMock("http://localhost:5501"); // MUST match Config.JWKS_URI in tests
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

    const seedAdminForAuth = async () => {
        const admin = await createUser(connection, {
            firstName: "Auth",
            lastName: "Admin",
            email: "authadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        return { admin, token: makeToken(admin) };
    };

    const validBody = {
        email: "newadmin@example.com",
        firstName: "New",
        lastName: "Admin",
        password: "StrongP@ssw0rd",
    };

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).post(route).send(validBody);
            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin calls the route", async () => {
            const mgr = await createUser(connection, {
                firstName: "Mgr",
                lastName: "User",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${makeToken(mgr)}`])
                .send(validBody);
            expect(res.statusCode).toBe(403);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app).post(route).set("Cookie", ["accessToken=not-a-jwt"]).send(validBody);
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const { admin } = await seedAdminForAuth();
            const expired = makeToken(admin, { exp: Math.floor(Date.now() / 1000) - 10 });
            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${expired}`])
                .send(validBody);
            expect(res.statusCode).toBe(401);
        });
    });

    describe("Validation", () => {
        it("400 when email is invalid", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, email: "not-an-email" });
            expect(res.statusCode).toBe(400);
        });

        it("400 when password length < 8", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, password: "short" });
            expect(res.statusCode).toBe(400);
        });

        it("400 when firstName is empty or missing", async () => {
            const { token } = await seedAdminForAuth();
            const res1 = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, firstName: "" });
            expect(res1.statusCode).toBe(400);

            const res2 = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, firstName: undefined } as any);
            expect(res2.statusCode).toBe(400);
        });

        it("400 when lastName is empty or missing", async () => {
            const { token } = await seedAdminForAuth();
            const res1 = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, lastName: "" });
            expect(res1.statusCode).toBe(400);

            const res2 = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, lastName: undefined } as any);
            expect(res2.statusCode).toBe(400);
        });

        it("400 when client sends forbidden fields: role or tenantId", async () => {
            const { token } = await seedAdminForAuth();

            const resRole = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, role: "admin" }); // forbidden by validator
            expect(resRole.statusCode).toBe(400);

            const resTenant = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, tenantId: 1 });
            expect(resTenant.statusCode).toBe(400);
        });
    });

    describe("Happy path", () => {
        it("201, returns created admin DTO; password not leaked; role is ADMIN; tenantId is null", async () => {
            const { token } = await seedAdminForAuth();

            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send(validBody);

            expect(res.statusCode).toBe(201);
            expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
            expect(res.body).toHaveProperty("user");

            const user = res.body.user;
            // normalizeEmail lowercases
            expect(user.email).toBe(validBody.email.toLowerCase());
            expect(user.firstName).toBe("New");
            expect(user.lastName).toBe("Admin");
            expect(user.role).toBe(Roles.ADMIN);
            expect(user).toHaveProperty("id");
            expect(user).toHaveProperty("tenantId"); // should be null for admin
            expect(typeof user.createdAt).toBe("string");
            expect(Number.isNaN(Date.parse(user.createdAt))).toBe(false);
            expect(user).not.toHaveProperty("password");

            // DB checks
            const repo = connection.getRepository(User);
            const dbUser = await repo.findOneOrFail({ where: { email: validBody.email.toLowerCase() } });
            expect(dbUser.role).toBe(Roles.ADMIN);
            expect(dbUser.password).not.toBe(validBody.password); // hashed
            // names are trimmed by validator
            expect(dbUser.firstName).toBe("New");
            expect(dbUser.lastName).toBe("Admin");
        });

        it("creates exactly one user record", async () => {
            const { token } = await seedAdminForAuth();
            const before = await connection.getRepository(User).count();
            await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send(validBody)
                .expect(201);
            const after = await connection.getRepository(User).count();
            expect(after).toBe(before + 1);
        });

        it("400 when email already exists (UserAlreadyExistsError) and does not create another record", async () => {
            const { token } = await seedAdminForAuth();

            // Seed an existing user with same email (any role)
            await createUser(connection, {
                firstName: "Dup",
                lastName: "User",
                email: validBody.email, // same casing
                password: "SomeP@ss123",
                role: Roles.MANAGER,
            });

            const before = await connection.getRepository(User).count();

            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send(validBody);

            expect(res.statusCode).toBe(400);

            const after = await connection.getRepository(User).count();
            expect(after).toBe(before);
        });

        it("normalizes email casing on create (upper → lower)", async () => {
            const { token } = await seedAdminForAuth();

            const mixed = { ...validBody, email: "NewAdmin@Example.COM" };
            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send(mixed);
            expect(res.statusCode).toBe(201);

            const repo = connection.getRepository(User);
            const dbUser = await repo.findOneOrFail({ where: { email: validBody.email.toLowerCase() } });
            expect(dbUser.email).toBe(validBody.email.toLowerCase());
        });

        it("trims firstName/lastName via validator", async () => {
            const { token } = await seedAdminForAuth();

            const res = await request(app)
                .post(route)
                .set("Cookie", [`accessToken=${token}`])
                .send({ ...validBody, firstName: "  New  ", lastName: " Admin  " });

            expect(res.statusCode).toBe(201);

            const repo = connection.getRepository(User);
            const dbUser = await repo.findOneOrFail({ where: { email: validBody.email } });
            expect(dbUser.firstName).toBe("New");
            expect(dbUser.lastName).toBe("Admin");
        });
    });
});
