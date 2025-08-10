export type CreateUserParams = {
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
};

export type PublicUserDto = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
};
