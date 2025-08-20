// tests/admin/users.list.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Roles } from "../../src/constants";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";

describe("GET /admin/users (paged, sorted, filtered, totals on)", () => {
    const route = "/admin/users";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (user: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        // MUST match Config.JWKS_URI in test env, e.g. http://localhost:5501
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

    // ---------------------------
    // Authorization / guards
    // ---------------------------
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

    // ---------------------------
    // Validation
    // ---------------------------
    it("400 on invalid query params (page<1, limit>100, bad sort/order/role, overly long q)", async () => {
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
            .query({
                page: 0, // invalid
                limit: 500, // invalid (expect validator to reject, not clamp)
                sort: "email", // invalid
                order: "ascending", // invalid
                role: "superuser", // invalid
                q: "a".repeat(500), // invalid length
            })
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(400);
        expect(res.headers["content-type"]).toEqual(expect.stringContaining("json"));
        expect(res.body).toHaveProperty("errors");
        const msgs = res.body.errors.map((e: any) => e.msg).join(" | ");
        expect(msgs).toMatch(/page/i);
        expect(msgs).toMatch(/limit/i);
        expect(msgs).toMatch(/sort/i);
        expect(msgs).toMatch(/order/i);
        expect(msgs).toMatch(/role/i);
        expect(msgs).toMatch(/q/i);
    });

    // ---------------------------
    // Baseline / response shape
    // ---------------------------
    it("200 with totals present; rows contain only public fields and include tenantId and createdAt", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Z",
            email: "adminz@example.com",
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

        // New contract: totals always present
        expect(res.body).toEqual(
            expect.objectContaining({
                rows: expect.any(Array),
                page: expect.any(Number),
                limit: expect.any(Number),
                sort: expect.any(String),
                order: expect.any(String),
                total: expect.any(Number),
                totalPages: expect.any(Number),
            }),
        );

        const u = res.body.rows[0];
        expect(u).toEqual(
            expect.objectContaining({
                id: admin.id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                role: Roles.ADMIN,
                tenantId: null,
            }),
        );
        expect(typeof u.createdAt).toBe("string");
        expect(u).not.toHaveProperty("password");
        expect(res.body.total).toBeGreaterThanOrEqual(1);
        expect(res.body.totalPages).toBeGreaterThanOrEqual(1);
    });

    // ---------------------------
    // Seed helpers
    // ---------------------------
    const seedManyUsers = async (n: number) => {
        const repo = connection.getRepository(User);
        const created: User[] = [];
        for (let i = 0; i < n; i++) {
            const u = repo.create({
                firstName: `U${String(i).padStart(3, "0")}`,
                lastName: `L${String(n - i).padStart(3, "0")}`,
                email: `u${i}@example.com`,
                password: "Xx123456!",
                role: i % 3 === 0 ? Roles.MANAGER : i % 2 === 0 ? Roles.CUSTOMER : Roles.ADMIN,
            });
            created.push(await repo.save(u));
        }
        return created;
    };

    // For tie-break tests on createdAt, force identical timestamps then vary id insertion order
    const seedSameCreatedAt = async () => {
        const repo = connection.getRepository(User);
        const base = new Date("2022-01-01T10:00:00.000Z");
        const u1 = await repo.save(
            repo.create({
                firstName: "Same",
                lastName: "A",
                email: "sameA@example.com",
                password: "x",
                role: Roles.CUSTOMER,
                createdAt: base,
            }),
        );
        const u2 = await repo.save(
            repo.create({
                firstName: "Same",
                lastName: "B",
                email: "sameB@example.com",
                password: "x",
                role: Roles.CUSTOMER,
                createdAt: base, // identical
            }),
        );
        return [u1, u2];
    };

    // ---------------------------
    // Pagination + totals math
    // ---------------------------

    it("caps limit at 100 when valid but large; validator should 400 if >100 un-clamped (we send 100 to be safe here)", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Cap",
            email: "capadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        await seedManyUsers(150);
        const token = makeToken(admin);

        const res = await request(app)
            .get(route)
            .query({ page: 1, limit: 100 }) // within cap
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        expect(res.body.limit).toBe(100);
        expect((res.body.rows as any[]).length).toBeLessThanOrEqual(100);
        expect(res.body.total).toBeGreaterThan(100);
        expect(res.body.totalPages).toBe(Math.ceil(res.body.total / 100));
    });

    it("page beyond available range returns empty rows, totals still accurate", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Far",
            email: "faradmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const extras = await seedManyUsers(5);
        const token = makeToken(admin);

        const total = 1 + extras.length;

        const res = await request(app)
            .get(route)
            .query({ page: 99, limit: 10, sort: "id", order: "desc" })
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        expect(res.body.page).toBe(99);
        expect(res.body.rows.length).toBe(0);
        expect(res.body.total).toBe(total);
        expect(res.body.totalPages).toBe(Math.ceil(total / 10));
    });

    // ---------------------------
    // Sorting
    // ---------------------------
    it("sort=id asc|desc works and matches order", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Sort",
            email: "sortadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        await seedManyUsers(12);
        const token = makeToken(admin);

        const asc = await request(app)
            .get(route)
            .query({ sort: "id", order: "asc", page: 1, limit: 10 })
            .set("Cookie", [`accessToken=${token}`])
            .send();
        const idsAsc = (asc.body.rows as any[]).map((r) => r.id);
        for (let i = 1; i < idsAsc.length; i++) {
            expect(idsAsc[i]).toBeGreaterThanOrEqual(idsAsc[i - 1]);
        }

        const desc = await request(app)
            .get(route)
            .query({ sort: "id", order: "desc", page: 1, limit: 10 })
            .set("Cookie", [`accessToken=${token}`])
            .send();
        const idsDesc = (desc.body.rows as any[]).map((r) => r.id);
        for (let i = 1; i < idsDesc.length; i++) {
            expect(idsDesc[i]).toBeLessThanOrEqual(idsDesc[i - 1]);
        }
    });

    it("filters by role (and totals reflect filtered set)", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Role",
            email: "roleadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        await seedManyUsers(25);
        const token = makeToken(admin);

        const res = await request(app)
            .get(route)
            .query({ role: "manager", page: 1, limit: 100 })
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        const rows = res.body.rows as any[];
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) expect(r.role).toBe(Roles.MANAGER);
        // Totals correspond to filtered set
        expect(res.body.total).toBe(rows.length); // because limit >= filtered count in this test
        expect(res.body.totalPages).toBe(1);
    });

    it("free-text search across firstName, lastName, and email (case-insensitive), totals correspond to search set", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "Q",
            email: "qadmin@gmail.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const repo = connection.getRepository(User);
        // deterministic dataset
        const a = await repo.save(
            repo.create({
                firstName: "Alice",
                lastName: "Zephyr",
                email: "alpha@example.com",
                password: "x",
                role: Roles.CUSTOMER,
            }),
        );
        const b = await repo.save(
            repo.create({
                firstName: "Bob",
                lastName: "ALbright",
                email: "bravo@example.com",
                password: "x",
                role: Roles.MANAGER,
            }),
        );
        const c = await repo.save(
            repo.create({
                firstName: "Carol",
                lastName: "Bee",
                email: "carol@EXAMPLE.com",
                password: "x",
                role: Roles.ADMIN,
            }),
        );

        const token = makeToken(admin);

        // match by firstName contains
        const q1 = await request(app)
            .get(route)
            .query({ q: "lic", limit: 50 })
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect(q1.statusCode).toBe(200);
        const rows1 = q1.body.rows as any[];
        expect(rows1.some((u: any) => u.firstName === "Alice")).toBe(true);
        expect(q1.body.total).toBe(rows1.length);
        expect(q1.body.totalPages).toBe(1);

        // match by lastName contains (case-insensitive)
        const q2 = await request(app)
            .get(route)
            .query({ q: "albr", limit: 50 })
            .set("Cookie", [`accessToken=${token}`])
            .send();
        expect(q2.statusCode).toBe(200);
        const rows2 = q2.body.rows as any[];
        expect(rows2.some((u: any) => u.lastName === "ALbright")).toBe(true);
        expect(q2.body.total).toBe(rows2.length);
        expect(q2.body.totalPages).toBe(1);

        // match by email contains (case-insensitive)
        const q3 = await request(app)
            .get(route)
            .query({ q: "EXAMPLE", limit: 50 })
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(q3.statusCode).toBe(200);

        // normalize for case-insensitive comparison
        const emails = (q3.body.rows as any[]).map((u) => u.email.toLowerCase());
        expect(emails).toEqual(expect.arrayContaining(["alpha@example.com", "bravo@example.com", "carol@example.com"]));

        // totals should equal filtered count (3) since limit is large
        expect(q3.body.total).toBe(3);
        expect(q3.body.totalPages).toBe(1);
    });

    // ---------------------------
    // Tenant mapping & safety
    // ---------------------------
    it("includes tenantId for manager users (FK, no join required)", async () => {
        const admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "T",
            email: "tadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        const token = makeToken(admin);

        const tenantRepo = connection.getRepository(Tenant);
        const t = await tenantRepo.save(tenantRepo.create({ name: "Shop 1", address: "Addr 1" }));

        const userRepo = connection.getRepository(User);
        const manager = userRepo.create({
            firstName: "M",
            lastName: "One",
            email: "m1@example.com",
            password: "Secret!234",
            role: Roles.MANAGER,
            tenantId: t.id, // direct FK
        });
        await userRepo.save(manager);

        const res = await request(app)
            .get(route)
            .set("Cookie", [`accessToken=${token}`])
            .send();

        expect(res.statusCode).toBe(200);
        const users = res.body.rows as any[];
        const m = users.find((u) => u.email === "m1@example.com");
        expect(m).toBeDefined();
        expect(m.tenantId).toBe(t.id);
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
