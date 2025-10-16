import Joi from 'joi';

export interface PayoutStatusQueryModel {
    roundId: string;
}

export const payoutStatusQuerySchema = Joi.object({
    roundId: Joi.string().required().messages({
        'string.empty': 'Round ID is required',
        'any.required': 'Round ID is required'
    })
});

