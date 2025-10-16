import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Payout } from './payout.model.js';

export enum PayoutType {
    ROUND = 'round',
    MANUAL = 'manual'
}

export enum TokenType {
    STABLECOIN = 'stablecoin',
    RECOGNITION = 'recognition'
}

export enum TxProposalStatus {
    PROPOSED = 'proposed',
    EXECUTED = 'executed',
    FAILED = 'failed',
    CANCELED = 'canceled'
}

@Entity('tx_proposals')
export class TxProposal {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Payout, (payout) => payout.txProposals)
    payout!: Payout;

    @Column({ type: 'enum', enum: PayoutType })
    payoutType!: PayoutType;

    @Column({ type: 'enum', enum: TokenType })
    tokenType!: TokenType;

    @Column()
    partIndex!: number;

    @Column()
    partCount!: number;

    @Column({ default: 1 })
    attempt!: number;

    @Column({ type: 'uuid', nullable: true })
    retryOfTxProposalId!: string;

    @Column({ nullable: true })
    safeTxHash!: string;

    @Column({ type: 'enum', enum: TxProposalStatus, default: TxProposalStatus.PROPOSED })
    status!: TxProposalStatus;

    @Column({ type: 'json', nullable: true })
    payloadJson!: any;

    @Column({ nullable: true })
    explorerUrl!: string;

    @CreateDateColumn()
    proposedAt!: Date;

    @UpdateDateColumn()
    executedAt!: Date;
}
