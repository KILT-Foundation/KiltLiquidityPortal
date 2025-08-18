/**
 * POSITION LIFECYCLE ROUTES
 * API endpoints for monitoring and controlling automatic position lifecycle management
 */

import type { Express } from "express";
import { positionLifecycleService } from "../position-lifecycle-service";

export function registerPositionLifecycleRoutes(app: Express) {
  /**
   * Get position lifecycle service status
   */
  app.get("/api/position-lifecycle/status", async (req, res) => {
    try {
      const status = positionLifecycleService.getStatus();
      res.json({
        success: true,
        status,
        message: status.isRunning ? "Position lifecycle service is running" : "Position lifecycle service is stopped"
      });
    } catch (error) {
      console.error('Position lifecycle status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get position lifecycle status'
      });
    }
  });

  /**
   * Manually trigger position check for specific user
   */
  app.post("/api/position-lifecycle/check-user/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      console.log(`🔍 Manual position check requested for user: ${address}`);
      await positionLifecycleService.checkSpecificUser(address);
      
      res.json({
        success: true,
        message: `Position check completed for ${address}`
      });
    } catch (error) {
      console.error(`Position check error for ${req.params.address}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to check user positions'
      });
    }
  });

  /**
   * Stop position lifecycle service (for maintenance)
   */
  app.post("/api/position-lifecycle/stop", async (req, res) => {
    try {
      positionLifecycleService.stop();
      
      res.json({
        success: true,
        message: "Position lifecycle service stopped"
      });
    } catch (error) {
      console.error('Position lifecycle stop error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop position lifecycle service'
      });
    }
  });

  /**
   * Start position lifecycle service
   */
  app.post("/api/position-lifecycle/start", async (req, res) => {
    try {
      positionLifecycleService.start();
      
      res.json({
        success: true,
        message: "Position lifecycle service started"
      });
    } catch (error) {
      console.error('Position lifecycle start error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start position lifecycle service'
      });
    }
  });
}