import { type Request, type Response, type NextFunction } from "express";
export interface AuthRequest extends Request {
    userId?: string;
}
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map