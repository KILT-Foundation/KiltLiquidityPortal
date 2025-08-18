import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";

// Minimal production-only server for emergency deployment
const app = express();

// Basic middleware
app.use(express.json());

// Health endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'kilt-liquidity-portal',
    environment: 'production-minimal',
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/test', (req: Request, res: Response) => {
  res.status(200).send(`
    <html>
      <body>
        <h1>Production Server Test</h1>
        <p>Environment: production-minimal</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Status: Working</p>
      </body>
    </html>
  `);
});

// Serve static files
const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

if (fs.existsSync(distPath)) {
  console.log('📁 Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  // SPA fallback for all routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({ error: 'API temporarily unavailable in minimal mode' });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  console.error('❌ No build directory found at:', distPath);
  app.get('*', (req, res) => {
    res.status(500).send(`
      <html>
        <body>
          <h1>Emergency: Build Error</h1>
          <p>No build directory found at: ${distPath}</p>
          <p>Please run 'npm run build' first</p>
        </body>
      </html>
    `);
  });
}

// Start server
const port = parseInt(process.env.PORT || '5000');
app.listen(port, '0.0.0.0', () => {
  console.log(`🚨 Minimal production server running on port ${port}`);
  console.log(`📍 Build directory: ${distPath}`);
  console.log(`📁 Build exists: ${fs.existsSync(distPath)}`);
});