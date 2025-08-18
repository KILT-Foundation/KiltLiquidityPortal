declare module 'cookie-parser' {
  import { Request, Response, NextFunction } from 'express';
  
  interface CookieParseOptions {
    decode?(val: string): string;
    secret?: string | string[];
  }
  
  function cookieParser(secret?: string | string[], options?: CookieParseOptions): (req: Request, res: Response, next: NextFunction) => void;
  
  export = cookieParser;
}