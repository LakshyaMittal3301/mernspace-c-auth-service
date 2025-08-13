// tests/admin/users.list.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Roles } from "../../src/constants";
import { createUser } from "../utils";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";

describe("GET /admin/users", () => {
    const route = "/admin/users";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (user: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        // MUST match Config.JWKS_URI in test env, e.g. http://localhost:5501
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

    it("401 when unauthenticated", async () => {
        const res = await request(app).get(route).send();
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
        const token = makeToken(manager);

        const res = await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect(res.statusCode).toBe(403);
    });

    it("200 with empty array when there are no users (aside from auth admin seed)", async () => {
        // seed an admin for auth
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "A",
            email: "admin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const token = makeToken(admin);

        const res = await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
        expect(res.body).toHaveProperty("users");
        expect(Array.isArray(res.body.users)).toBe(true);

        // At minimum should contain the admin we created
        const users = res.body.users;
        expect(users.length).toBe(1);
        expect(users[0]).toEqual(
            expect.objectContaining({
                id: admin.id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                role: Roles.ADMIN,
            }),
        );
        expect(typeof users[0].createdAt).toBe("string"); // JSON sends strings
        expect(Object.keys(users[0])).toEqual(
            expect.arrayContaining(["id", "firstName", "lastName", "email", "createdAt", "role", "tenantId"]),
        );
        expect(users[0]).not.toHaveProperty("password");
    });

    it("includes tenantId for manager users (requires service to load relations)", async () => {
        // admin for auth
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Z",
            email: "adminz@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const token = makeToken(admin);

        // create a tenant and a manager assigned to it
        const tenantRepo = connection.getRepository(Tenant);
        const t = await tenantRepo.save(tenantRepo.create({ name: "Shop 1", address: "Addr 1" }));

        const userRepo = connection.getRepository(User);
        const manager = userRepo.create({
            firstName: "M",
            lastName: "One",
            email: "m1@example.com",
            password: "Secret!234", // will be stored as is in test db unless you hash in createUser
            role: Roles.MANAGER,
            tenant: t,
        });
        await userRepo.save(manager);

        const res = await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        const users = res.body.users as any[];

        // find the manager in the list
        const m = users.find((u) => u.email === "m1@example.com");
        expect(m).toBeDefined();
        expect(m.tenantId).toBe(t.id); // will be null if you forgot relations: ["tenant"]
    });

    it("does not leak sensitive fields (no password)", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Safe",
            email: "safeadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const token = makeToken(admin);

        const res = await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        const anyUser = res.body.users[0];
        expect(anyUser).not.toHaveProperty("password");
    });

    it("does not modify the database (read-only)", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "RO",
            email: "roadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const token = makeToken(admin);

        const before = await connection.getRepository(User).count();
        await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send()
            .expect(200);
        const after = await connection.getRepository(User).count();

        expect(after).toBe(before);
    });
});
