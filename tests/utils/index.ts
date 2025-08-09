import { DataSource } from "typeorm";
import { User } from "../../src/entity/User";
import { Roles } from "../../src/constants";
import bcrypt from "bcrypt";

export const truncateTables = async (connection: DataSource) => {
    const entities = connection.entityMetadatas;

    for (const entity of entities) {
        const repository = connection.getRepository(entity.name);
        await repository.clear();
    }
};

export const isJWT = (token: string): boolean => {
    const parts = token.split(".");

    if (parts.length != 3) return false;

    try {
        parts.forEach((part) => {
            Buffer.from(part, "base64").toString("utf-8");
        });
    } catch (err) {
        return false;
    }

    return true;
};

export const createUser = async (
    connection: DataSource,
    {
        firstName,
        lastName,
        email,
        password,
        role = Roles.CUSTOMER,
    }: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role?: string;
    },
): Promise<User> => {
    const userRepo = connection.getRepository(User);

    return userRepo.save({
        firstName,
        lastName,
        email,
        password,
        role,
    });
};

export const createUserWithHashedPassword = async (
    connection: DataSource,
    {
        firstName,
        lastName,
        email,
        password,
        role = Roles.CUSTOMER,
    }: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role?: string;
    },
): Promise<User> => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userRepo = connection.getRepository(User);

    return userRepo.save({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
    });
};
