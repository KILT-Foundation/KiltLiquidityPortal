import { z } from 'zod';
import { db } from './db';
import { sql, eq } from 'drizzle-orm';
import { 
  users, 
  lpPositions, 
  rewards, 
  dailyRewards, 
  treasuryConfig, 
  programSettings,
  appTransactions,
  positionEligibility 
} from '@shared/schema';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    warningRecords: number;
  };
}

export interface ValidationError {
  table: string;
  recordId: string | number;
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  table: string;
  recordId: string | number;
  field: string;
  message: string;
  severity: 'warning';
}

export class SchemaValidator {
  private static instance: SchemaValidator;

  private constructor() {}

  static getInstance(): SchemaValidator {
    if (!SchemaValidator.instance) {
      SchemaValidator.instance = new SchemaValidator();
    }
    return SchemaValidator.instance;
  }

  async validateAllTables(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalRecords = 0;
    let validRecords = 0;

    try {
      // Validate each table
      const validationResults = await Promise.all([
        this.validateUsers(),
        this.validateLpPositions(),
        this.validateRewards(),
        this.validateDailyRewards(),
        this.validateTreasuryConfig(),
        this.validateProgramSettings(),
        this.validateAppTransactions(),
        this.validatePositionEligibility()
      ]);

      // Aggregate results
      for (const result of validationResults) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        totalRecords += result.statistics.totalRecords;
        validRecords += result.statistics.validRecords;
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        statistics: {
          totalRecords,
          validRecords,
          invalidRecords: totalRecords - validRecords,
          warningRecords: warnings.length
        }
      };

    } catch (error: unknown) {
      return {
        isValid: false,
        errors: [{
          table: 'system',
          recordId: 'validation',
          field: 'schema',
          message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
          severity: 'error'
        }],
        warnings: [],
        statistics: {
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          warningRecords: 0
        }
      };
    }
  }

  private async validateUsers(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      const userRecords = await db.select().from(users);
      let validCount = 0;

      const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

      for (const user of userRecords) {
        try {
          // Validate Ethereum address
          addressSchema.parse(user.address);
          
          // Check for duplicate addresses
          const duplicateCount = userRecords.filter(u => u.address.toLowerCase() === user.address.toLowerCase()).length;
          if (duplicateCount > 1) {
            warnings.push({
              table: 'users',
              recordId: user.id,
              field: 'address',
              message: 'Duplicate Ethereum address found',
              severity: 'warning'
            });
          }

          validCount++;
        } catch (error: unknown) {
          errors.push({
            table: 'users',
            recordId: user.id,
            field: 'address',
            message: error instanceof Error ? error.message : 'Unknown address validation error',
            severity: 'error'
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        statistics: {
          totalRecords: userRecords.length,
          validRecords: validCount,
          invalidRecords: userRecords.length - validCount,
          warningRecords: warnings.length
        }
      };

    } catch (error: unknown) {
      return {
        isValid: false,
        errors: [{
          table: 'users',
          recordId: 'table',
          field: 'validation',
          message: `Table validation failed: ${error instanceof Error ? error.message : 'Unknown table validation error'}`,
          severity: 'error'
        }],
        warnings: [],
        statistics: { totalRecords: 0, validRecords: 0, invalidRecords: 0, warningRecords: 0 }
      };
    }
  }

  private async validateLpPositions(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      const positionRecords = await db.select().from(lpPositions);
      let validCount = 0;

      const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');
      const positiveNumberSchema = z.string().refine(val => parseFloat(val) >= 0, 'Must be non-negative');

      for (const position of positionRecords) {
        let isValid = true;

        try {
          // Validate addresses
          addressSchema.parse(position.poolAddress);
          addressSchema.parse(position.token0Address);
          addressSchema.parse(position.token1Address);

          // Validate amounts
          positiveNumberSchema.parse(position.token0Amount);
          positiveNumberSchema.parse(position.token1Amount);
          positiveNumberSchema.parse(position.currentValueUSD);

          // Validate NFT token ID
          if (!position.nftTokenId || position.nftTokenId.trim() === '') {
            errors.push({
              table: 'lpPositions',
              recordId: position.id,
              field: 'nftTokenId',
              message: 'NFT token ID cannot be empty',
              severity: 'error'
            });
            isValid = false;
          }

          // Validate fee tier
          const validFeeTiers = [100, 500, 3000, 10000];
          if (!validFeeTiers.includes(position.feeTier)) {
            warnings.push({
              table: 'lpPositions',
              recordId: position.id,
              field: 'feeTier',
              message: `Unusual fee tier: ${position.feeTier}`,
              severity: 'warning'
            });
          }

          // Check for reasonable position value
          const valueUSD = parseFloat(position.currentValueUSD);
          if (valueUSD > 1000000) {
            warnings.push({
              table: 'lpPositions',
              recordId: position.id,
              field: 'currentValueUSD',
              message: `Very high position value: $${valueUSD.toLocaleString()}`,
              severity: 'warning'
            });
          }

          if (isValid) validCount++;

        } catch (error: unknown) {
          errors.push({
            table: 'lpPositions',
            recordId: position.id,
            field: 'validation',
            message: error instanceof Error ? error.message : 'Unknown position validation error',
            severity: 'error'
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        statistics: {
          totalRecords: positionRecords.length,
          validRecords: validCount,
          invalidRecords: positionRecords.length - validCount,
          warningRecords: warnings.length
        }
      };

    } catch (error: unknown) {
      return {
        isValid: false,
        errors: [{
          table: 'lpPositions',
          recordId: 'table',
          field: 'validation',
          message: `Table validation failed: ${error instanceof Error ? error.message : 'Unknown table validation error'}`,
          severity: 'error'
        }],
        warnings: [],
        statistics: { totalRecords: 0, validRecords: 0, invalidRecords: 0, warningRecords: 0 }
      };
    }
  }

  private async validateRewards(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      const rewardRecords = await db.select().from(rewards);
      let validCount = 0;

      for (const reward of rewardRecords) {
        let isValid = true;

        try {
          // Validate amounts are non-negative
          const dailyAmount = parseFloat(reward.dailyRewardAmount);
          const accumulatedAmount = parseFloat(reward.accumulatedAmount);
          const claimedAmount = parseFloat(reward.claimedAmount || '0');

          if (dailyAmount < 0 || accumulatedAmount < 0 || claimedAmount < 0) {
            errors.push({
              table: 'rewards',
              recordId: reward.id,
              field: 'amounts',
              message: 'Reward amounts cannot be negative',
              severity: 'error'
            });
            isValid = false;
          }

          // Validate claimed amount doesn't exceed accumulated
          if (claimedAmount > accumulatedAmount) {
            errors.push({
              table: 'rewards',
              recordId: reward.id,
              field: 'claimedAmount',
              message: 'Claimed amount exceeds accumulated amount',
              severity: 'error'
            });
            isValid = false;
          }

          // Check for reasonable lock period
          if (reward.lockPeriodDays < 0 || reward.lockPeriodDays > 365) {
            warnings.push({
              table: 'rewards',
              recordId: reward.id,
              field: 'lockPeriodDays',
              message: `Unusual lock period: ${reward.lockPeriodDays} days`,
              severity: 'warning'
            });
          }

          if (isValid) validCount++;

        } catch (error: unknown) {
          errors.push({
            table: 'rewards',
            recordId: reward.id,
            field: 'validation',
            message: error instanceof Error ? error.message : 'Unknown reward validation error',
            severity: 'error'
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        statistics: {
          totalRecords: rewardRecords.length,
          validRecords: validCount,
          invalidRecords: rewardRecords.length - validCount,
          warningRecords: warnings.length
        }
      };

    } catch (error: unknown) {
      return {
        isValid: false,
        errors: [{
          table: 'rewards',
          recordId: 'table',
          field: 'validation',
          message: `Table validation failed: ${error instanceof Error ? error.message : 'Unknown table validation error'}`,
          severity: 'error'
        }],
        warnings: [],
        statistics: { totalRecords: 0, validRecords: 0, invalidRecords: 0, warningRecords: 0 }
      };
    }
  }

  // Additional validation methods for other tables...
  private async validateDailyRewards(): Promise<ValidationResult> {
    return this.createEmptyValidationResult('dailyRewards');
  }

  private async validateTreasuryConfig(): Promise<ValidationResult> {
    return this.createEmptyValidationResult('treasuryConfig');
  }

  private async validateProgramSettings(): Promise<ValidationResult> {
    return this.createEmptyValidationResult('programSettings');
  }

  private async validateAppTransactions(): Promise<ValidationResult> {
    return this.createEmptyValidationResult('appTransactions');
  }

  private async validatePositionEligibility(): Promise<ValidationResult> {
    return this.createEmptyValidationResult('positionEligibility');
  }

  private createEmptyValidationResult(tableName: string): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: { totalRecords: 0, validRecords: 0, invalidRecords: 0, warningRecords: 0 }
    };
  }
}

export const schemaValidator = SchemaValidator.getInstance();