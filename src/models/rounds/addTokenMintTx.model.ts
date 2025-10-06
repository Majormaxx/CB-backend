import Joi from 'joi';

export interface AddTokenMintTxModel {
    roundId: string;
    txHash: string;
}

export const addTokenMintTxSchema = Joi.object({
    roundId: Joi.string().uuid().required(),
    txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required()
});

