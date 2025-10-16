import Joi from 'joi';

export interface ProposePayoutModel {
    roundId: string;
    tokenType: 'STABLECOIN' | 'RECOGNITION';
}

export const proposePayoutSchema = Joi.object({
    roundId: Joi.string().required().messages({
        'string.empty': 'Round ID is required',
        'any.required': 'Round ID is required'
    }),
    tokenType: Joi.string()
        .valid('STABLECOIN', 'RECOGNITION')
        .required()
        .messages({
            'string.empty': 'Token type is required',
            'any.required': 'Token type is required',
            'any.only': 'Token type must be either STABLECOIN or RECOGNITION'
        })
});

