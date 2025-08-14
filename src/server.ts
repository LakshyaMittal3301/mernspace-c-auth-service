import app from "./app";
import { Config } from "./config";
import { AppDataSource } from "./config/data-source";
import logger from "./config/logger";
import { bootstrapAdmin } from "./services/bootstrapAdmin";
import PasswordService from "./services/PasswordService";

const startServer = async () => {
    const PORT = Config.PORT;

    try {
        await AppDataSource.initialize();
        logger.info("Database Connected Successfully");

        await bootstrapAdmin(AppDataSource, new PasswordService());
        logger.info("Admin bootsrap complete");

        app.listen(PORT, () => {
            logger.info("Server listening on port", { port: PORT });
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

startServer();
