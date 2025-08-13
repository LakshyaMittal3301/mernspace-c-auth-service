import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import request from "supertest";
import app from "../../src/app";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";
import { createUser } from "../utils";
import { User } from "../../src/entity/User";
import { Tenant } from "../../src/entity/Tenant";

describe("GET /admin/users/:id", () => {
    const route = (id: string | number) => `/admin/users/${id}`;
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (u: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(u.id), role: u.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        // MUST match Config.JWKS_URI in your test env
        jwks = createJWKSMock("http://localhost:5501");
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

    it("401 when unauthenticated", async () => {
        const res = await request(app).get(route(1)).send();
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
            .get(route(mgr.id))
            .set("Cookie", [`accessToken=${makeToken(mgr)}`])
            .send();
        expect(res.statusCode).toBe(403);
    });

    it("401 when access token is invalid", async () => {
        const res = await request(app).get(route(1)).set("Cookie", ["accessToken=not-a-jwt"]).send();
        expect(res.statusCode).toBe(401);
    });

    it("401 when access token is expired", async () => {
        const { admin } = await seedAdminForAuth();
        const expired = makeToken(admin, { exp: Math.floor(Date.now() / 1000) - 10 });
        const res = await request(app)
            .get(route(1))
            .set("Cookie", [`accessToken=${expired}`])
            .send();
        expect(res.statusCode).toBe(401);
    });

    it("400 when id is not a number", async () => {
        const { token } = await seedAdminForAuth();
        const res = await request(app)
            .get(route("abc"))
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect(res.statusCode).toBe(400);
    });

    it("404 when user id does not exist", async () => {
        const { token } = await seedAdminForAuth();
        const res = await request(app)
            .get(route(999999))
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect(res.statusCode).toBe(404);
    });

    it("returns 200 with admin user DTO; tenantId is null; password not leaked", async () => {
        const { token } = await seedAdminForAuth();

        // create another admin to fetch
        const target = await createUser(connection, {
            firstName: "Fetch",
            lastName: "Admin",
            email: "fetchadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });

        const res = await request(app)
            .get(route(target.id))
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
        expect(res.body).toHaveProperty("user");

        const user = res.body.user;
        expect(user).toEqual(
            expect.objectContaining({
                id: target.id,
                email: target.email,
                firstName: target.firstName,
                lastName: target.lastName,
                role: Roles.ADMIN,
            }),
        );
        expect(typeof user.createdAt).toBe("string"); // JSON datetime
        expect(user).toHaveProperty("tenantId");
        expect(user.tenantId).toBeNull(); // admins have no tenant
        expect(user).not.toHaveProperty("password");
    });

    it("returns 200 with manager DTO; tenantId populated", async () => {
        const { token } = await seedAdminForAuth();

        // seed tenant + manager
        const tenantRepo = connection.getRepository(Tenant);
        const t = await tenantRepo.save(tenantRepo.create({ name: "Shop X", address: "Addr X" }));

        const userRepo = connection.getRepository(User);
        const manager = await userRepo.save(
            userRepo.create({
                firstName: "Mana",
                lastName: "Ger",
                email: "manager@x.com",
                password: "StrongP@ssw0rd",
                role: Roles.MANAGER,
                // if you exposed tenantId on User, prefer tenantId: t.id; else use relation:
                tenantId: (t as any).id ?? undefined,
                tenant: (t as any).id ? undefined : t,
            }) as any,
        );

        const res = await request(app)
            .get(route(manager.id))
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        const u = res.body.user;
        expect(u.id).toBe(manager.id);
        expect(u.email).toBe("manager@x.com");
        expect(u.role).toBe(Roles.MANAGER);
        // Will be null if you didn’t expose tenantId or didn’t load relation; adjust per your mapping
        expect(u.tenantId === t.id || u.tenantId === (manager as any).tenantId).toBe(true);
        expect(u).not.toHaveProperty("password");
    });

    it("read-only: does not modify the database", async () => {
        const { token } = await seedAdminForAuth();

        // create a target to fetch
        const target = await createUser(connection, {
            firstName: "Read",
            lastName: "Only",
            email: "readonly@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });

        const before = await connection.getRepository(User).count();
        await request(app)
            .get(route(target.id))
            .set("Cookie", [`accessToken=${token}`])
            .send()
            .expect(200);
        const after = await connection.getRepository(User).count();

        expect(after).toBe(before);
    });

    it("treats negative/zero ids as invalid or not found (pick one and lock it)", async () => {
        const { token } = await seedAdminForAuth();

        const res0 = await request(app)
            .get(route(0))
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect([400, 404]).toContain(res0.statusCode);

        const resNeg = await request(app)
            .get(route(-12))
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect([400, 404]).toContain(resNeg.statusCode);
    });
});
