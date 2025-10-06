import { injectable } from 'inversify';
import { Response } from 'express';
import { handleResponse } from '../models/response_models/request_handler.js';
import { RoundService } from '../services/round.service.js';
import { CreateAssessmentModel, createAssessmentSchema } from '../models/rounds/createAssessment.model.js';
import { UserService } from '../services/user.service.js';
import { Request } from 'express';

@injectable()
export class RoundsController {

    constructor(
        private roundService: RoundService,
        private userService: UserService
    ) { }


    /**
     * Retrieves the current round for the user's organization.
     */
    public getCurrentRound = async (req: Request, res: Response) => {
        try {
            const walletAddress = req.user!.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            if (!responseModel.data?.organization?.id) {
                return res.status(403).json({ message: 'User does not have an org' });
            }
            const createdResponseModel = await this.roundService.getCurrentRound(responseModel.data?.organization?.id);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Retrieves all rounds for the user's organization.
     */
    public getRounds = async (req: Request, res: Response) => {
        try {
            const walletAddress = req.user!.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            if (!responseModel.data?.organization?.id) {
                return res.status(403).json({ message: 'User does not have an org' });
            }
            const createdResponseModel = await this.roundService.getRounds(responseModel.data?.organization?.id);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Retrieves a round by its ID.
     */
    public getRoundById = async (req: Request, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const createdResponseModel = await this.roundService.getRoundById(roundId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Edits a round.
     */
    public editRound = async (req: Request, res: Response) => {
        try {
            const model = req.body;
            const walletAddress = req.user!.walletAddress;
            const responseModel = await this.userService.getByWalletAddress(walletAddress);
            if (!responseModel.data?.isAdmin) {
                return res.status(403).json({ message: 'User is not an admin' });
            }
            if (!responseModel.data?.organization?.id) {
                return res.status(403).json({ message: 'User does not have an org' });
            }

            const createdResponseModel = await this.roundService
                .editRound(req.params.roundId, model);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Adds an assessment to a round.
     */
    public addAssessment = async (req: Request, res: Response) => {
        try {
            const model: CreateAssessmentModel = req.body!;
            const responseModel = await this.roundService.addAssessment(req.user!.walletAddress, model);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }


    /**
     * Edits an assessment.
     */
    public editAssessment = async (req: Request, res: Response) => {
        try {
            const assessmentId = req.params.assessmentId;
            const model: CreateAssessmentModel = req.body!;
            const responseModel = await this.roundService.editAssessment(assessmentId, req.user!.walletAddress, model);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error editing assessment:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Retrieves assessments for a round.
     */
    public getAssessments = async (req: Request, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const assessorId = typeof req.query.assessorId === 'string' ? req.query.assessorId : undefined;
            const assessedId = typeof req.query.assessedId === 'string' ? req.query.assessedId : undefined;
            const createdResponseModel = await this.roundService.getAssessments(roundId, assessorId, assessedId);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error getting assessments:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Sends a reminder to assess.
     */
    public remind = async (req: Request, res: Response) => {
        try {
            const roundId = req.params.roundId;
            const { all, users } = req.body;
            const createdResponseModel = await this.roundService.remindToAssess(roundId, all, users);
            res.status(createdResponseModel.statusCode).json(handleResponse(createdResponseModel));
        } catch (error) {
            console.error('Error editing an org:', error);
            res.status(500).send('Internal Server Error');
        }
    }


    /**
     * Adds a token mint transaction to a round.
     */
    public addTokenMintTx = async (req: Request, res: Response) => {
        try {
            const { roundId, txHash } = req.body;
            const responseModel = await this.roundService.addTokenMintTx(roundId, txHash);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error adding token mint tx:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}