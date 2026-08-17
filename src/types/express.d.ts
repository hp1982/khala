import 'express';

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        username: string;
        nickname: string | null;
        email: string | null;
        role: number;
        status: number;
      };
    }
  }
}