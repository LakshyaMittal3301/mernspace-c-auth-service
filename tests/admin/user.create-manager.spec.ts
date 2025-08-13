// tests/admin/users.create-manager.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import request from "supertest";
import app from "../../src/app";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";
import { createUser } from "../utils";
import { User } from "../../src/entity/User";
import { Tenant } from "../../src/entity/Tenant";

describe("POST /admin/users/managers", () => {
    const route = "/admin/users/managers";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (u: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(u.id), role: u.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        jwks = createJWKSMock("http://localhost:5501"); // must match Config.JWKS_URI in tests
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await connection.dropDatabase();
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

    const seedTenant = async (name = "Shop A") => {
        const repo = connection.getRepository(Tenant);
        return repo.save(repo.create({ name, address: "Addr" }));
    };

    const baseBody = (tenantId: number) => ({
        email: "manager@example.com",
        firstName: "Mana",
        lastName: "Ger",
        password: "StrongP@ssw0rd",
        tenantId,
    });

    // --- Auth / RBAC ---
    it("401 when unauthenticated", async () => {
        const t = await seedTenant();
        const res = await request(app).post(route).send(baseBody(t.id));
        expect(res.statusCode).toBe(401);
    });

    it("403 when non-admin calls the route", async () => {
        const t = await seedTenant();
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
            .send(baseBody(t.id));
        expect(res.statusCode).toBe(403);
    });

    it("401 when access token is invalid", async () => {
        const t = await seedTenant();
        const res = await request(app).post(route).set("Cookie", ["accessToken=not-a-jwt"]).send(baseBody(t.id));
        expect(res.statusCode).toBe(401);
    });

    it("401 when access token is expired", async () => {
        const { admin } = await seedAdminForAuth();
        const t = await seedTenant();
        const expired = makeToken(admin, { exp: Math.floor(Date.now() / 1000) - 10 });
        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${expired}`])
            .send(baseBody(t.id));
        expect(res.statusCode).toBe(401);
    });

    // --- Validation ---
    it("400 when email is invalid", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), email: "not-an-email" });
        expect(res.statusCode).toBe(400);
    });

    it("400 when password length < 8", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), password: "short" });
        expect(res.statusCode).toBe(400);
    });

    it("400 when firstName is empty or missing", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const res1 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), firstName: "" });
        expect(res1.statusCode).toBe(400);

        const res2 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), firstName: undefined } as any);
        expect(res2.statusCode).toBe(400);
    });

    it("400 when lastName is empty or missing", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const res1 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), lastName: "" });
        expect(res1.statusCode).toBe(400);

        const res2 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), lastName: undefined } as any);
        expect(res2.statusCode).toBe(400);
    });

    it("400 when tenantId is missing or not an integer", async () => {
        const { token } = await seedAdminForAuth();

        const res1 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({
                ...baseBody(1),
                tenantId: undefined,
            } as any);
        expect(res1.statusCode).toBe(400);

        const res2 = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(1), tenantId: "abc" });
        expect(res2.statusCode).toBe(400);
    });

    it("accepts stringish tenantId and trims first/last if validator uses toInt/trim", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();

        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({
                ...baseBody(t.id),
                tenantId: `  ${t.id}  `,
                firstName: "  Mana  ",
                lastName: "  Ger ",
            });

        expect(res.statusCode).toBe(201);

        const repo = connection.getRepository(User);
        const db = await repo.findOneOrFail({ where: { email: "manager@example.com" } });
        expect(db.firstName).toBe("Mana");
        expect(db.lastName).toBe("Ger");
    });

    it("400 when client sends forbidden fields: role", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), role: "manager" });
        expect(res.statusCode).toBe(400);
    });

    // --- Business rules ---
    it("400/404 when tenantId does not exist", async () => {
        const { token } = await seedAdminForAuth();
        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send(baseBody(999999));
        expect([400, 404]).toContain(res.statusCode); // pick one in your service and lock the test
    });

    it("400 when email already exists; does not create new record", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();

        await createUser(connection, {
            firstName: "Dup",
            lastName: "User",
            email: "manager@example.com",
            password: "SomeP@ss123",
            role: Roles.MANAGER,
        });

        const before = await connection.getRepository(User).count();

        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send(baseBody(t.id));

        expect(res.statusCode).toBe(400);

        const after = await connection.getRepository(User).count();
        expect(after).toBe(before);
    });

    // --- Happy path ---
    it("201, returns created manager DTO; password not leaked; role=MANAGER; tenantId set; email normalized", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();

        const res = await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send({ ...baseBody(t.id), email: "Manager@Example.COM" });

        expect(res.statusCode).toBe(201);
        expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
        expect(res.body).toHaveProperty("user");

        const user = res.body.user;
        expect(user).toHaveProperty("id");
        expect(typeof user.createdAt).toBe("string");
        expect(user.email).toBe("manager@example.com"); // normalized
        expect(user.firstName).toBe("Mana");
        expect(user.lastName).toBe("Ger");
        expect(user.role).toBe(Roles.MANAGER);
        expect(user.tenantId).toBe(t.id);
        expect(user).not.toHaveProperty("password");

        // DB assertions
        const repo = connection.getRepository(User);
        const dbUser = await repo.findOneOrFail({ where: { email: "manager@example.com" } });
        expect(dbUser.role).toBe(Roles.MANAGER);
        expect(dbUser.password).not.toBe("StrongP@ssw0rd"); // hashed
        // If you exposed tenantId on the entity (recommended), assert it:
        // @ts-ignore (if tenantId added as a column)
        expect((dbUser as any).tenantId ?? dbUser.tenant?.id).toBe(t.id);
    });

    it("creates exactly one user record", async () => {
        const { token } = await seedAdminForAuth();
        const t = await seedTenant();
        const before = await connection.getRepository(User).count();

        await request(app)
            .post(route)
            .set("Cookie", [`accessToken=${token}`])
            .send(baseBody(t.id))
            .expect(201);

        const after = await connection.getRepository(User).count();
        expect(after).toBe(before + 1);
    });
});
