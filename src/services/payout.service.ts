import { injectable, inject } from 'inversify';
import { getRepository, Repository } from 'typeorm';
import { Payout } from '../entities/payout/payout.model.js';
import { PayoutRecipient } from '../entities/payout/payout-recipient.model.js';
import { TxProposal } from '../entities/payout/tx-proposal.model.js';

@injectable()
export class PayoutService {
    private payoutRepository: Repository<Payout>;
    private payoutRecipientRepository: Repository<PayoutRecipient>;
    private txProposalRepository: Repository<TxProposal>;

    constructor() {
        this.payoutRepository = getRepository(Payout);
        this.payoutRecipientRepository = getRepository(PayoutRecipient);
        this.txProposalRepository = getRepository(TxProposal);
    }

    /**
     * Preview payout for a round with recipient details, amounts, and validation warnings.
     *
     * Implementation deferred to Module-II (Payouts feature).
     * Module-I focuses on Safe and token configuration only.
     *
     * @param roundId - The round ID to preview payouts for
     * @returns Payout preview with recipients, amounts, balance checks, and warnings
     */
    public async previewPayout(roundId: string): Promise<any> {
        throw new Error('previewPayout is not implemented in Module-I. This feature will be available in Module-II (Payouts).');
    }

    /**
     * Propose payout transactions to Safe multisig for a round.
     *
     * Implementation deferred to Module-II (Payouts feature).
     * Module-I focuses on Safe and token configuration only.
     *
     * @param roundId - The round ID to propose payouts for
     * @param tokenType - Type of token (stablecoin or recognition)
     * @returns Safe transaction proposal details
     */
    public async proposePayout(roundId: string, tokenType: string): Promise<any> {
        throw new Error('proposePayout is not implemented in Module-I. This feature will be available in Module-II (Payouts).');
    }
}