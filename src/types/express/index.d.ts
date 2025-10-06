declare global {
    namespace Express {
        interface Request {
            user?: {
                walletAddress: string;
                [key: string]: any;
            }
        }
    }
}