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

    public async previewPayout(roundId: string): Promise<any> {
        // TODO: Implement payout preview logic
        return null;
    }

    public async proposePayout(roundId: string, tokenType: string): Promise<any> {
        // TODO: Implement payout proposal logic
        return null;
    }
}