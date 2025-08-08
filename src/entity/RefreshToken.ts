import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

@Entity()
export class RefreshToken {
    @PrimaryGeneratedColumn()
    id: number;

    @UpdateDateColumn()
    updatedAt: number;

    @CreateDateColumn()
    createdAt: number;

    @Column({ type: "timestamp" })
    expiresAt: Date;

    @ManyToOne(() => User)
    user: User;
}
