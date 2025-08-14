import { DataSource } from "typeorm";
import { Config } from "../config";
import { AdminCredentialsNotFound } from "../errors/AdminCredentialsNotFound";
import logger from "../config/logger";
import { User } from "../entity/User";
import { IPasswordService } from "../interfaces/services/IPasswordService";
import { Roles } from "../constants";

const LOCK_KEY_1 = 41717;
const LOCK_KEY_2 = 1;

export const bootstrapAdmin = async (ds: DataSource, passwordService: IPasswordService): Promise<void> => {
    if (!Config.ADMIN_EMAIL || !Config.ADMIN_PASSWORD) {
        throw new AdminCredentialsNotFound();
    }

    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();

    try {
        const [{ locked }] = await queryRunner.query(`SELECT pg_try_advisory_lock($1,$2) AS locked`, [
            LOCK_KEY_1,
            LOCK_KEY_2,
        ]);

        if (!locked) {
            logger.info("Another instance is bootsrapping admin; skipping on this instance");
            return;
        }

        const userRepo = queryRunner.manager.getRepository(User);

        const hashedPassword = await passwordService.hashPassword(Config.ADMIN_PASSWORD);

        await userRepo
            .createQueryBuilder()
            .insert()
            .values({
                email: Config.ADMIN_EMAIL,
                password: hashedPassword,
                firstName: Config.ADMIN_FIRST_NAME,
                lastName: Config.ADMIN_LAST_NAME,
                role: Roles.ADMIN,
            })
            .orIgnore()
            .execute();

        logger.info(`Admin bootstrap attempted for ${Config.ADMIN_EMAIL}`);
    } finally {
        await queryRunner.query("SELECT pg_advisory_unlock($1,$2)", [LOCK_KEY_1, LOCK_KEY_2]).catch(() => {});
        await queryRunner.release();
    }
};
