import { injectable } from 'inversify';
import { Request, Response } from 'express';
import { UserService } from '../services/user.service.js';
import { CreateUserModel, createUserScheme } from '../models/user/userRegistration.model.js';
import { handleResponse } from '../models/response_models/request_handler.js';
import { verifySignatureSchema, walletAddressSchema } from '../models/user/wallet.model.js';
import { uploadFileToS3 } from '../utils/fileUploader.js';

@injectable()
export class UserController {

    constructor(private userService: UserService) { }

    /**
     * Request a nonce for wallet authentication
     */
    public requestNonce = async (req: Request, res: Response) => {
        try {
            // Request nonce from the AuthService
            const responseModel = await this.userService.requestNonce(req.body.walletAddress);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error requesting nonce:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Verify the signed nonce to authenticate the user
     */
    public verifySignature = async (req: Request, res: Response) => {
        try {
            const { message, signature } = req.body;

            // Verify the signature and authenticate the user
            const responseModel = await this.userService.verifySignature(message, signature);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error verifying signature:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Register a new user
     */
    public registerUser = async (req: Request, res: Response) => {
        try {
            const model: CreateUserModel = req.body;

            const file = req.file;
            let avatarUrl: string | undefined;

            if (file) {
                const uploadResult = await uploadFileToS3({
                    Bucket: process.env.S3_BUCKET_NAME!,
                    Key: `user-avatars/${file.originalname}`,
                    Body: file.buffer,
                    ContentType: file.mimetype
                });

                avatarUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${uploadResult}`;
            }

            const responseModel = await this.userService.registerUser({
                ...model,
                profilePicture: avatarUrl,
                walletAddress: req.user!.walletAddress
            });
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).send('Internal Server Error');
        }
    }


    /**
     * Get User Me
     */
    public getUserMe = async (req: Request, res: Response) => {
        try {
            const responseModel = await this.userService.getByWalletAddress(req.user!.walletAddress);
            res.status(responseModel.statusCode).json(handleResponse(responseModel));
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
