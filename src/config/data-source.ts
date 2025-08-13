import "reflect-metadata";
import { DataSource } from "typeorm";
import { Config } from ".";
import path from "path";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: Config.DB_HOST,
    port: Number(Config.DB_PORT),
    username: Config.DB_USERNAME,
    password: Config.DB_PASSWORD,
    database: Config.DB_NAME,
    // Don't use this in prod, always keep false
    synchronize: false,
    logging: false,
    entities: [path.join(__dirname, "..", "entity", "*.{js,ts}")],
    migrations: [path.join(__dirname, "..", "migration", "*.{js,ts}")],
    subscribers: [],
});
