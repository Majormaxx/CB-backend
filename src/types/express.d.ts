import { User } from '../entities/users/user.model.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
