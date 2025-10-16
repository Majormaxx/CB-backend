import Joi from 'joi';

export interface PayoutPreviewQueryModel {
    roundId: string;
}

export const payoutPreviewQuerySchema = Joi.object({
    roundId: Joi.string().required().messages({
        'string.empty': 'Round ID is required',
        'any.required': 'Round ID is required'
    })
});

