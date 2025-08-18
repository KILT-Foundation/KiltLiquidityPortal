// Production-safe server startup that handles errors gracefully
import express, { Request, Response, NextFunction } from "express";

export function createProductionSafeApp(): express.Application {
  const app = express();
  
  // Trust proxy for deployment environments
  app.set('trust proxy', 1);
  
  // Basic security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
  
  // Essential middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  
  // Emergency health endpoint that always works
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'kilt-liquidity-portal',
      environment: process.env.NODE_ENV || 'unknown'
    });
  });
  
  // Fallback error handler
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Production error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });
  
  return app;
}

export function startProductionServer(app: express.Application): void {
  const port = parseInt(process.env.PORT || '5000');
  
  app.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    console.log(`✅ Production server running on port ${port}`);
  });
}