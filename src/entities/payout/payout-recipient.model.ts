import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Payout } from './payout.model.js';
import { TxProposal } from './tx-proposal.model.js';
import { User } from '../users/user.model.js';
import { TokenType } from './tx-proposal.model.js';

export enum PayoutRecipientStatus {
    PENDING = 'pending',
    PROPOSED = 'proposed',
    EXECUTED = 'executed',
    FAILED = 'failed',
    SKIPPED = 'skipped'
}

@Entity('payout_recipients')
export class PayoutRecipient {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Payout)
    payout!: Payout;

    @Column({ nullable: true })
    roundCompensationId!: string;

    @ManyToOne(() => User)
    user!: User;

    @Column()
    walletAddressSnapshot!: string;

    @Column({ type: 'enum', enum: TokenType })
    tokenType!: TokenType;

    @Column()
    tokenAddressSnapshot!: string;

    @Column()
    tokenDecimalsSnapshot!: number;

    @Column({ type: 'decimal', precision: 18, scale: 6 })
    amountHuman!: number;

    @Column({ type: 'decimal', precision: 30, scale: 0 })
    amountBaseUnits!: string;

    @ManyToOne(() => TxProposal)
    txProposal!: TxProposal;

    @Column()
    partIndex!: number;

    @Column()
    partCount!: number;

    @Column({ default: 1 })
    attempt!: number;

    @Column({ type: 'enum', enum: PayoutRecipientStatus, default: PayoutRecipientStatus.PENDING })
    status!: PayoutRecipientStatus;

    @Column({ nullable: true })
    error!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
