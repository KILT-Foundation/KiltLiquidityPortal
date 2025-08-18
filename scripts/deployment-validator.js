#!/usr/bin/env node

/**
 * Deployment Configuration Validator
 * Ensures proper deployment setup to prevent frontend serving issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 Validating deployment configuration...');

const errors = [];
const warnings = [];

// 1. Check .replit file configuration
const replitPath = path.join(rootDir, '.replit');
if (!fs.existsSync(replitPath)) {
  errors.push('Missing .replit file');
} else {
  const replitContent = fs.readFileSync(replitPath, 'utf-8');
  
  // Check deployment section
  if (!replitContent.includes('[deployment]')) {
    errors.push('.replit missing [deployment] section');
  }
  
  if (!replitContent.includes('build = ["npm", "run", "build"]')) {
    errors.push('.replit missing correct build command');
  }
  
  if (!replitContent.includes('run = ["npm", "run", "start"]')) {
    errors.push('.replit missing correct production run command');
  }
  
  console.log('✅ .replit configuration validated');
}

// 2. Check package.json scripts
const packagePath = path.join(rootDir, 'package.json');
if (!fs.existsSync(packagePath)) {
  errors.push('Missing package.json file');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  if (!packageJson.scripts) {
    errors.push('package.json missing scripts section');
  } else {
    if (!packageJson.scripts.build) {
      errors.push('package.json missing build script');
    }
    
    if (!packageJson.scripts.start) {
      errors.push('package.json missing start script');
    } else if (!packageJson.scripts.start.includes('NODE_ENV=production')) {
      warnings.push('start script should include NODE_ENV=production');
    }
    
    if (!packageJson.scripts.dev) {
      warnings.push('package.json missing dev script');
    }
  }
  
  console.log('✅ package.json scripts validated');
}

// 3. Check build directory exists after build
const distPath = path.join(rootDir, 'dist');
const publicPath = path.join(distPath, 'public');
const indexPath = path.join(publicPath, 'index.html');

if (!fs.existsSync(distPath)) {
  warnings.push('dist/ directory not found - run npm run build');
} else if (!fs.existsSync(publicPath)) {
  warnings.push('dist/public/ directory not found - build may have failed');
} else if (!fs.existsSync(indexPath)) {
  warnings.push('dist/public/index.html not found - frontend build incomplete');
} else {
  console.log('✅ Build output validated');
}

// 4. Check server production configuration
const serverIndexPath = path.join(rootDir, 'server', 'index.ts');
if (!fs.existsSync(serverIndexPath)) {
  errors.push('Missing server/index.ts file');
} else {
  const serverContent = fs.readFileSync(serverIndexPath, 'utf-8');
  
  if (!serverContent.includes('NODE_ENV=production')) {
    warnings.push('Server should check for production mode');
  }
  
  if (!serverContent.includes('serving from build directory')) {
    warnings.push('Server should serve static files in production');
  }
  
  console.log('✅ Server configuration validated');
}

// 5. Check vite.config.ts build output
const viteConfigPath = path.join(rootDir, 'vite.config.ts');
if (!fs.existsSync(viteConfigPath)) {
  errors.push('Missing vite.config.ts file');
} else {
  const viteContent = fs.readFileSync(viteConfigPath, 'utf-8');
  
  if (!viteContent.includes('outDir: path.resolve(import.meta.dirname, "dist/public")')) {
    warnings.push('vite.config.ts should output to dist/public');
  }
  
  console.log('✅ Vite configuration validated');
}

// Report results
console.log('\n📋 Validation Results:');

if (errors.length > 0) {
  console.log('\n❌ ERRORS (Must Fix):');
  errors.forEach(error => console.log(`  • ${error}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (Should Review):');
  warnings.forEach(warning => console.log(`  • ${warning}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All deployment configurations are correct!');
  console.log('\n🚀 Ready for deployment with:');
  console.log('  • Production build: npm run build');
  console.log('  • Production start: npm run start');
  console.log('  • Replit deployment: Use Deploy button');
}

if (errors.length > 0) {
  console.log('\n🔧 Fix the errors above before deploying');
  process.exit(1);
}

console.log('\n💡 To prevent future issues:');
console.log('  • Always run this validator before deploying');
console.log('  • Test production mode locally: npm run build && npm run start');
console.log('  • Verify deployment serves React frontend, not just API');