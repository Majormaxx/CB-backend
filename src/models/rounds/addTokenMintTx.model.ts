import Joi from 'joi';

export interface AddTokenMintTxModel {
  roundId: string;
  txHash: string;
}

export const addTokenMintTxSchema = Joi.object({
  roundId: Joi.string().required(),
  txHash: Joi.string().required()
});

