# Deployment Safety Checklist

This checklist prevents deployment configuration issues and ensures the React frontend is properly served.

## Pre-Deployment Validation

### 1. Build Verification
```bash
# Run the deployment validator
node scripts/deployment-validator.js

# Build and test production mode locally
npm run build
npm run start  # Should show "Production mode: serving from build directory"
```

### 2. Configuration Checks

**✅ .replit file must contain:**
```
[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]
```

**✅ package.json must contain:**
```json
{
  "scripts": {
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

**✅ server/index.ts must handle production mode:**
- Check `if (app.get("env") === "development")` for dev server
- Check `else if (fs.existsSync(distPath))` for production static files
- Serve from `dist/public` directory in production

### 3. Build Output Verification
```bash
# These files must exist after build:
ls dist/index.js           # Server bundle
ls dist/public/index.html  # Frontend HTML
ls dist/public/assets/     # Frontend assets
```

### 4. Local Production Test
```bash
# Test production mode locally (different port to avoid conflicts)
NODE_ENV=production PORT=3001 node dist/index.js

# Should show:
# "Production mode: serving from build directory"
# Visit http://localhost:3001 - should show React app, not API response
```

## Common Issues & Fixes

### Issue: Deployment shows API response instead of React app
**Cause:** Server running in development mode or missing static file configuration
**Fix:** Ensure `.replit` uses `npm run start` and server has production static file serving

### Issue: "API endpoint not found" error
**Cause:** Missing health endpoint or incorrect server routes
**Fix:** Add health endpoint and verify API routes are registered before static serving

### Issue: Build directory not found
**Cause:** Build command failed or incorrect output directory
**Fix:** Check `vite.config.ts` outputs to `dist/public` and rebuild

## Deployment Process

1. **Validate:** `node scripts/deployment-validator.js`
2. **Build:** `npm run build`
3. **Test Locally:** `npm run start` (different terminal)
4. **Deploy:** Click Deploy button in Replit
5. **Verify:** New URL serves React frontend, not JSON

## Environment Variables Required

For production deployment, ensure these are set in Replit Secrets:
- `DATABASE_URL` - PostgreSQL connection
- `CALCULATOR_PRIVATE_KEY` - Smart contract interaction
- `REWARD_WALLET_PRIVATE_KEY` - Reward distribution (optional)

## Monitoring Endpoints

After deployment, verify these endpoints work:
- `/` - React frontend (not JSON response)
- `/api/health` - Health check endpoint
- `/api/kilt-data` - Real-time KILT data
- `/test` - Server diagnostic page

## Emergency Rollback

If deployment fails:
1. Check deployment logs in Replit
2. Verify environment variables are set
3. Use deployment validator to identify issues
4. Redeploy after fixing configuration

---

**Last Updated:** August 2025  
**Next Review:** Before any major deployment changes