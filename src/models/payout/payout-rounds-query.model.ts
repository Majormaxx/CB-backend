import Joi from 'joi';

export interface PayoutRoundsQueryModel {
    orgId: string;
}

export const payoutRoundsQuerySchema = Joi.object({
    orgId: Joi.string().required().messages({
        'string.empty': 'Organization ID is required',
        'any.required': 'Organization ID is required'
    })
});

