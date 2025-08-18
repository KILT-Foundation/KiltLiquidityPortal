// Emergency production fallback server
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚨 Starting emergency production fallback server...');

const app = express();

// Basic middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// Essential health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'emergency-fallback',
    environment: process.env.NODE_ENV || 'unknown'
  });
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'emergency-fallback',
    environment: process.env.NODE_ENV || 'unknown'
  });
});

// Basic KILT data endpoint with static response
app.get('/api/kilt-data', (req, res) => {
  res.json({
    price: 0.016213,
    marketCap: 4490587.53,
    circulatingSupply: 276970000,
    volume24h: 1252.05,
    priceChange24h: -3.76,
    totalSupply: 290560000,
    mode: 'emergency-fallback'
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  try {
    const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
    res.sendFile(indexPath);
  } catch (error) {
    res.status(500).send('Emergency server error');
  }
});

const port = parseInt(process.env.PORT || '5000');
app.listen(port, '0.0.0.0', () => {
  console.log(`🚨 Emergency fallback server running on port ${port}`);
});