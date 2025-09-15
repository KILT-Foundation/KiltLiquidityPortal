/**
 * Cron Scheduler Service
 * Handles automated daily reward accrual and other scheduled tasks
 */

import * as cron from 'node-cron';
import { dailyRewardAccrualService } from './daily-reward-accrual-service';
import { hourlyRewardAccrualService } from './hourly-reward-accrual-service';

export class CronScheduler {
  private isRunning = false;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Cron scheduler is already running');
      return;
    }

    console.log('🚀 Starting cron scheduler...');
    
    // Randomized hourly snapshot scheduling only
    this.scheduleRandomizedHourlySnapshots();

    this.isRunning = true;
    console.log('✅ Cron scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Cron scheduler is not running');
      return;
    }

    console.log('🛑 Stopping cron scheduler...');

    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️  Stopped job: ${name}`);
    });

    this.scheduledJobs.clear();
    this.isRunning = false;
    console.log('✅ Cron scheduler stopped successfully');
  }

  /**
   * Schedule snapshots with randomization inside each hour window.
   * Strategy: Every hour at minute 0, schedule a one-off job at a random minute within [0, 59].
   */
  private scheduleRandomizedHourlySnapshots(): void {
    const controllerJobName = 'hourly-randomizer-controller';

    // Controller runs every hour exactly on the hour (UTC)
    const controller = cron.schedule('00 * * * *', () => {
      const now = new Date();
      const randomMinute = Math.floor(Math.random() * 60); // 0-59
      const jobName = `hourly-snapshot-${Date.now()}`;

      console.log(`🕐 [${now.toISOString()}] Cron controller triggered - scheduling snapshot for minute ${randomMinute}`);

      // Schedule a one-off job for this hour at random minute
      const expression = `${randomMinute} * * * *`;
      const job = cron.schedule(expression, async () => {
        const snapshotTime = new Date();
        console.log(`🚀 [${snapshotTime.toISOString()}] Starting hourly snapshot execution...`);
        
        try {
          const result = await hourlyRewardAccrualService.processHourlySnapshot(snapshotTime);
          if (!result.success) {
            console.error(`❌ [${snapshotTime.toISOString()}] Hourly snapshot failed:`, result.message, result.errors);
          } else {
            console.log(`✅ [${snapshotTime.toISOString()}] Hourly snapshot completed: ${result.message}`);
          }
        } catch (error) {
          console.error(`💥 [${snapshotTime.toISOString()}] Hourly snapshot crashed:`, error);
        } finally {
          // Stop this one-off job after execution
          try { job.stop(); } catch {}
          this.scheduledJobs.delete(jobName);
          console.log(`🏁 [${new Date().toISOString()}] Snapshot job cleaned up`);
        }
      }, { timezone: 'UTC' });

      this.scheduledJobs.set(jobName, job);
      job.start();
      console.log(`⏰ Scheduled randomized hourly snapshot at minute ${randomMinute} (UTC) for this hour`);
    }, { timezone: 'UTC' });

    this.scheduledJobs.set(controllerJobName, controller);
    controller.start();
    console.log('⏰ Scheduled hourly randomizer controller: runs every hour at :00 (UTC)');
  }



  /**
   * Get status of all scheduled jobs
   */
  getStatus(): {
    isRunning: boolean;
    jobs: Array<{
      name: string;
      isRunning: boolean;
      nextRun: Date | null;
    }>;
  } {
    const jobs = Array.from(this.scheduledJobs.entries()).map(([name, job]) => ({
      name,
      isRunning: job.getStatus() === 'scheduled',
      nextRun: null // node-cron doesn't provide nextDate method
    }));

    return {
      isRunning: this.isRunning,
      jobs
    };
  }
}

// Export singleton instance
export const cronScheduler = new CronScheduler();
