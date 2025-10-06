import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Organization } from '../org/organization.model.js';
import { TxProposal } from './tx-proposal.model.js';

export enum PayoutStatus {
    DRAFT = 'draft',
    PROPOSED = 'proposed',
    EXECUTED = 'executed',
    PARTIAL = 'partial',
    FAILED = 'failed',
}

@Entity('payouts')
export class Payout {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Organization)
    organization!: Organization;

    @Column({ nullable: true })
    roundId!: string;

    @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.DRAFT })
    status!: PayoutStatus;

    @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
    totalStablePayout!: number;

    @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
    totalRecognitionPayout!: number;

    @OneToMany(() => TxProposal, (txProposal) => txProposal.payout, { cascade: true })
    txProposals!: TxProposal[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}