import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
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

    @Column({ name: "tenantId", nullable: true })
    tenantId: number | null;

    @ManyToOne(() => Tenant, { nullable: true })
    @JoinColumn({ name: "tenantId" })
    tenant: Tenant | null;

    @OneToMany(() => RefreshToken, (rt) => rt.user)
    refreshTokens: RefreshToken[];
}
