import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Relation } from 'typeorm';
import { CompensationPeriod } from './cycle.enum.js';
import { Round } from '../assessment/round.model.js';
import { User } from '../users/user.model.js';

/**
 * Defines the modes for recognition tokens, specifying whether a custom
 * token is used or if recognition is disabled.
 */
export enum RecognitionTokenMode {
    CUSTOM = 'custom',
    NONE = 'none',
}

@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'varchar', length: 255 })
    teamPointsContractAddress!: string;

    @Column({ type: 'int', nullable: false, default: 42161 })
    chainId!: number;

    @Column({ type: 'varchar', nullable: true })
    logo?: string;

    @Column({ type: 'int', default: 20 })
    par!: number;

    @Column({ type: 'int', default: 0 })
    totalFunds!: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdOn!: Date;

    @Column('enum', { enum: CompensationPeriod, nullable: true })
    compensationPeriod!: CompensationPeriod | null;

    @Column({ type: 'timestamp', nullable: true })
    compensationStartDay!: Date | null;

    @Column({ type: 'int', nullable: true })
    assessmentDurationInDays!: number | null;

    @Column({ type: 'int', nullable: true })
    assessmentStartDelayInDays!: number | null;

    @OneToMany(() => Round, (round) => round.organization, { cascade: true })
    rounds?: Relation<Round[]>;

    @OneToMany(() => User, (user) => user.organization, { cascade: false })
    contributors?: Relation<User[]>;

    /**
     * The address of the Gnosis Safe used for treasury management.
     * This is optional and can be configured by the organization admin.
     */
    @Column({ type: 'varchar', length: 255, nullable: true })
    safeAddress?: string;

    /**
     * The chain ID where the Gnosis Safe is deployed.
     * This is optional and corresponds to the network of the Safe.
     */
    @Column({ type: 'int', nullable: true })
    safeChainId?: number;

    /**
     * The contract address of the stablecoin used for compensation payouts.
     * This is optional and is defined by the organization.
     */
    @Column({ type: 'varchar', length: 255, nullable: true })
    stablecoinAddress?: string;

    /**
     * The number of decimals for the stablecoin, used for precise calculations.
     * This is optional and is typically 6 or 18.
     */
    @Column({ type: 'int', nullable: true })
    stablecoinDecimals?: number;

    /**
     * The contract address of the custom recognition token.
     * This is optional and is used if the organization has its own token.
     */
    @Column({ type: 'varchar', length: 255, nullable: true })
    recognitionTokenAddress?: string;

    /**
     * The number of decimals for the recognition token.
     * This is optional and is defined by the token contract.
     */
    @Column({ type: 'int', nullable: true })
    recognitionTokenDecimals?: number;

    /**
     * The mode for the recognition token, indicating if it's a custom token or none.
     * This is optional and defaults to NONE.
     */
    @Column('enum', { enum: RecognitionTokenMode, nullable: true })
    recognitionTokenMode?: RecognitionTokenMode;
}