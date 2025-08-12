import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Tenant } from "./Tenant";
import { RefreshToken } from "./RefreshToken";

@Entity({ name: "users" })
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @UpdateDateColumn()
    updatedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    role: string;

    @ManyToOne(() => Tenant)
    tenant: Tenant | null;

    @OneToMany(() => RefreshToken, (rt) => rt.user)
    refreshTokens: RefreshToken[];
}
