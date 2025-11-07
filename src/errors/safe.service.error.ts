export class SafeServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SafeServiceError';
        Object.setPrototypeOf(this, SafeServiceError.prototype);
    }
}

