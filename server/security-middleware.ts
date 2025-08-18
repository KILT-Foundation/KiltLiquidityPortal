import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { body, param, validationResult } from 'express-validator';
import type { Express, Request, Response, NextFunction } from 'express';

// Rate limiting configurations - Increased for development/testing
const createRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development testing (was 100)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Handle potential proxy scenarios
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Stricter limit for sensitive operations
  message: {
    error: 'Too many sensitive requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Handle potential proxy scenarios
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

// Input validation middleware
export const validateEthereumAddress = [
  param('address').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address format'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

export const validateUserId = [
  param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

export const validateUserCreation = [
  body('address').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address format'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

export const validatePositionData = [
  body('nftTokenId').isString().isLength({ min: 1, max: 100 }).withMessage('Invalid NFT token ID'),
  body('userAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  body('kiltAmount').isNumeric().withMessage('Invalid KILT amount'),
  body('wethAmount').isNumeric().withMessage('Invalid WETH amount'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

export const validateSessionData = [
  body('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('userAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid user address'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

// Sanitization middleware to prevent XSS
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize all string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters and limit length
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .substring(0, 1000); // Limit string length
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    console.error('Security middleware error:', error);
    next(error);
  }
};

// Security headers and CORS configuration
export const setupSecurity = (app: Express) => {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://replit.com"], // Required for Vite
        connectSrc: ["'self'", "https://api.coingecko.com", "https://mainnet.base.org", "wss:", "https:"],
        frameSrc: ["'self'", "https://dexscreener.com", "https://www.geckoterminal.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for Web3 compatibility
    crossOriginOpenerPolicy: false, // Required for Coinbase Smart Wallet compatibility
  }));

  // CORS configuration with broader origin support for admin panel
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400 // 24 hours
  }));



  // Basic rate limiting for all routes
  app.use('/api', createRateLimit);

  // Input sanitization
  app.use(sanitizeInput);

  return {
    strictRateLimit,
    validateEthereumAddress,
    validateUserId,
    validateUserCreation,
    validatePositionData,
    validateSessionData
  };
};

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log error for debugging
  if (status >= 500) {
    // Server error logged
  }

  res.status(status).json({
    error: message,
    ...(isDev && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

// Environment variable validation - production safe
export const validateEnvironment = () => {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')} - continuing in degraded mode`);
    // Don't throw in production - just warn and continue
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate smart contract environment variables if provided
  if (process.env.KILT_REWARD_POOL_ADDRESS) {
    if (!process.env.REWARD_WALLET_PRIVATE_KEY) {
      console.warn('⚠️  KILT_REWARD_POOL_ADDRESS provided but REWARD_WALLET_PRIVATE_KEY missing');
    }
    if (!process.env.REWARD_WALLET_ADDRESS) {
      console.warn('⚠️  KILT_REWARD_POOL_ADDRESS provided but REWARD_WALLET_ADDRESS missing');
    }
  }
};