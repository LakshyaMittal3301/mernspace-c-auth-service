// tests/bootstrap/bootstrap.admin.e2e.spec.ts
import { DataSource, QueryRunner } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { User } from "../../src/entity/User";
import { Roles } from "../../src/constants";
import { bootstrapAdmin } from "../../src/services/bootstrapAdmin";
import PasswordService from "../../src/services/PasswordService";
import type { IPasswordService } from "../../src/interfaces/services/IPasswordService";
import { Config } from "../../src/config";
import { AdminCredentialsNotFound } from "../../src/errors/AdminCredentialsNotFound";
import { clearAllTablesExceptMigrations } from "../utils"; // you already have this

// Must match the keys used inside bootstrapAdmin
const LOCK_KEY_1 = 41717;
const LOCK_KEY_2 = 1;

describe("bootstrapAdmin (E2E)", () => {
    let ds: DataSource;
    let passwordSvc: IPasswordService;

    // Keep originals so we can restore after tests
    const originalConfig = {
        ADMIN_EMAIL: (Config as any).ADMIN_EMAIL,
        ADMIN_PASSWORD: (Config as any).ADMIN_PASSWORD,
        ADMIN_FIRST_NAME: (Config as any).ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME: (Config as any).ADMIN_LAST_NAME,
    };

    beforeAll(async () => {
        ds = await AppDataSource.initialize();
        await ds.runMigrations();
        passwordSvc = new PasswordService();
    });

    beforeEach(async () => {
        // Ensure we have sane defaults before each test
        (Config as any).ADMIN_EMAIL = "root@example.com";
        (Config as any).ADMIN_PASSWORD = "Admin@123";
        (Config as any).ADMIN_FIRST_NAME = "System";
        (Config as any).ADMIN_LAST_NAME = "Admin";

        await clearAllTablesExceptMigrations(ds);
    });

    afterAll(async () => {
        // restore original Config values
        (Config as any).ADMIN_EMAIL = originalConfig.ADMIN_EMAIL;
        (Config as any).ADMIN_PASSWORD = originalConfig.ADMIN_PASSWORD;
        (Config as any).ADMIN_FIRST_NAME = originalConfig.ADMIN_FIRST_NAME;
        (Config as any).ADMIN_LAST_NAME = originalConfig.ADMIN_LAST_NAME;

        await ds.destroy();
    });

    it("throws AdminCredentialsNotFound when ADMIN_* missing", async () => {
        (Config as any).ADMIN_EMAIL = undefined;
        (Config as any).ADMIN_PASSWORD = undefined;

        await expect(bootstrapAdmin(ds, passwordSvc)).rejects.toBeInstanceOf(AdminCredentialsNotFound);

        // DB should still be empty
        const count = await ds.getRepository(User).count();
        expect(count).toBe(0);
    });

    it("inserts exactly one admin with hashed password and ADMIN role", async () => {
        // precondition: no user
        const repo = ds.getRepository(User);
        expect(await repo.count()).toBe(0);

        await bootstrapAdmin(ds, passwordSvc);

        const users = await repo.find();
        expect(users.length).toBe(1);

        const u = users[0];
        expect(u.email).toBe((Config as any).ADMIN_EMAIL); // function does not normalize casing
        expect(u.role).toBe(Roles.ADMIN);
        expect(u.firstName).toBe((Config as any).ADMIN_FIRST_NAME);
        expect(u.lastName).toBe((Config as any).ADMIN_LAST_NAME);

        // password is hashed (not equal to plain)
        expect(u.password).toBeDefined();
        expect(typeof u.password).toBe("string");
        expect(u.password).not.toBe((Config as any).ADMIN_PASSWORD);
    });

    it("is idempotent: second run does nothing (no duplicate row)", async () => {
        const repo = ds.getRepository(User);
        await bootstrapAdmin(ds, passwordSvc);
        const count1 = await repo.count();

        await bootstrapAdmin(ds, passwordSvc);
        const count2 = await repo.count();

        expect(count1).toBe(1);
        expect(count2).toBe(1);
    });

    it("skips creation if advisory lock is held by another session", async () => {
        // Hold the lock from another connection
        const holder: QueryRunner = ds.createQueryRunner();
        await holder.connect();
        await holder.query("SELECT pg_advisory_lock($1,$2)", [LOCK_KEY_1, LOCK_KEY_2]);

        try {
            // With the lock held by someone else, bootstrapAdmin should skip the insert
            const repo = ds.getRepository(User);
            expect(await repo.count()).toBe(0);

            await bootstrapAdmin(ds, passwordSvc);

            // No row should have been inserted
            expect(await repo.count()).toBe(0);
        } finally {
            // Release the held lock
            await holder.query("SELECT pg_advisory_unlock($1,$2)", [LOCK_KEY_1, LOCK_KEY_2]).catch(() => {});
            await holder.release();
        }
    });

    it("releases the lock it acquires (subsequent session can acquire)", async () => {
        // Ensure there is work to do (no existing user)
        await bootstrapAdmin(ds, passwordSvc);

        // At this point, bootstrapAdmin has finished. We should be able to acquire the same lock from a new session.
        const qr = ds.createQueryRunner();
        await qr.connect();
        try {
            const [{ locked }] = await qr.query("SELECT pg_try_advisory_lock($1,$2) AS locked", [
                LOCK_KEY_1,
                LOCK_KEY_2,
            ]);
            expect(locked).toBe(true); // lock is free → successfully acquired
        } finally {
            await qr.query("SELECT pg_advisory_unlock($1,$2)", [LOCK_KEY_1, LOCK_KEY_2]).catch(() => {});
            await qr.release();
        }
    });

    it("does not overwrite an existing admin's password on rerun", async () => {
        const repo = ds.getRepository(User);

        await bootstrapAdmin(ds, passwordSvc);
        const first = await repo.findOneByOrFail({ email: (Config as any).ADMIN_EMAIL });
        const firstHash = first.password;

        // Change ADMIN_PASSWORD in Config; rerun bootstrap
        (Config as any).ADMIN_PASSWORD = "Changed@123";
        await bootstrapAdmin(ds, passwordSvc);

        const again = await repo.findOneByOrFail({ email: (Config as any).ADMIN_EMAIL });
        expect(again.password).toBe(firstHash); // unchanged because .orIgnore() prevents update
    });
});
