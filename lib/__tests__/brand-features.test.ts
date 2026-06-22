/**
 * Unit tests for Brand Features Configuration System
 *
 * These tests verify that:
 * - NFL brand has leave management features enabled
 * - Default brand works correctly with features disabled
 * - All utility functions work as expected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrandFeatures,
  DEFAULT_FEATURES,
  isFeatureEnabled,
  isLeaveTypeEnabled,
  getEnabledLeaveTypes,
  clearFeaturesCache,
} from '../brand-features';

// NFL brand features configuration (matches public/NFL/brand-features.json)
const NFL_FEATURES: BrandFeatures = {
  brandId: 'NFL',
  features: {
    leaveManagement: {
      enabled: true,
      leaveTypes: {
        vacation: { enabled: true },
        sickLeave: { enabled: true },
        floatingHoliday: { enabled: true },
        paidHoliday: { enabled: true },
      },
    },
    approvalWorkflows: { enabled: true },
    policyEnforcement: { enabled: true },
    accrualCalculations: { enabled: true },
  },
};

// Default brand features configuration (matches public/Default/brand-features.json)
const DEFAULT_BRAND_FEATURES: BrandFeatures = {
  brandId: 'Default',
  features: {
    leaveManagement: { enabled: false },
    approvalWorkflows: { enabled: false },
    policyEnforcement: { enabled: false },
    accrualCalculations: { enabled: false },
  },
};

describe('Brand Features Configuration', () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearFeaturesCache();
  });

  describe('DEFAULT_FEATURES constant', () => {
    it('should have all features disabled by default', () => {
      expect(DEFAULT_FEATURES.brandId).toBe('Default');
      expect(DEFAULT_FEATURES.features.leaveManagement.enabled).toBe(false);
      expect(DEFAULT_FEATURES.features.approvalWorkflows.enabled).toBe(false);
      expect(DEFAULT_FEATURES.features.policyEnforcement.enabled).toBe(false);
      expect(DEFAULT_FEATURES.features.accrualCalculations.enabled).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    describe('NFL brand (leave management enabled)', () => {
      it('should return true for leaveManagement', () => {
        expect(isFeatureEnabled(NFL_FEATURES, 'leaveManagement')).toBe(true);
      });

      it('should return true for approvalWorkflows', () => {
        expect(isFeatureEnabled(NFL_FEATURES, 'approvalWorkflows')).toBe(true);
      });

      it('should return true for policyEnforcement', () => {
        expect(isFeatureEnabled(NFL_FEATURES, 'policyEnforcement')).toBe(true);
      });

      it('should return true for accrualCalculations', () => {
        expect(isFeatureEnabled(NFL_FEATURES, 'accrualCalculations')).toBe(true);
      });
    });

    describe('Default brand (features disabled)', () => {
      it('should return false for leaveManagement', () => {
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'leaveManagement')).toBe(false);
      });

      it('should return false for approvalWorkflows', () => {
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'approvalWorkflows')).toBe(false);
      });

      it('should return false for policyEnforcement', () => {
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'policyEnforcement')).toBe(false);
      });

      it('should return false for accrualCalculations', () => {
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'accrualCalculations')).toBe(false);
      });
    });
  });

  describe('isLeaveTypeEnabled', () => {
    describe('NFL brand (leave management enabled)', () => {
      it('should return true for vacation leave', () => {
        expect(isLeaveTypeEnabled(NFL_FEATURES, 'vacation')).toBe(true);
      });

      it('should return true for sick leave', () => {
        expect(isLeaveTypeEnabled(NFL_FEATURES, 'sickLeave')).toBe(true);
      });

      it('should return true for floating holiday', () => {
        expect(isLeaveTypeEnabled(NFL_FEATURES, 'floatingHoliday')).toBe(true);
      });

      it('should return true for paid holiday', () => {
        expect(isLeaveTypeEnabled(NFL_FEATURES, 'paidHoliday')).toBe(true);
      });

      it('should return false for non-existent leave type', () => {
        expect(isLeaveTypeEnabled(NFL_FEATURES, 'nonExistent')).toBe(false);
      });
    });

    describe('Default brand (leave management disabled)', () => {
      it('should return false for any leave type when leave management is disabled', () => {
        expect(isLeaveTypeEnabled(DEFAULT_BRAND_FEATURES, 'vacation')).toBe(false);
        expect(isLeaveTypeEnabled(DEFAULT_BRAND_FEATURES, 'sickLeave')).toBe(false);
        expect(isLeaveTypeEnabled(DEFAULT_BRAND_FEATURES, 'floatingHoliday')).toBe(false);
        expect(isLeaveTypeEnabled(DEFAULT_BRAND_FEATURES, 'paidHoliday')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should return false when leaveTypes is undefined', () => {
        const featuresWithoutTypes: BrandFeatures = {
          brandId: 'Test',
          features: {
            leaveManagement: { enabled: true }, // enabled but no leaveTypes
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        };
        expect(isLeaveTypeEnabled(featuresWithoutTypes, 'vacation')).toBe(false);
      });

      it('should return false for disabled leave type', () => {
        const featuresWithDisabledType: BrandFeatures = {
          brandId: 'Test',
          features: {
            leaveManagement: {
              enabled: true,
              leaveTypes: {
                vacation: { enabled: false },
              },
            },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        };
        expect(isLeaveTypeEnabled(featuresWithDisabledType, 'vacation')).toBe(false);
      });
    });
  });

  describe('getEnabledLeaveTypes', () => {
    describe('NFL brand (leave management enabled)', () => {
      it('should return all four enabled leave types', () => {
        const enabledTypes = getEnabledLeaveTypes(NFL_FEATURES);
        expect(enabledTypes).toHaveLength(4);
        expect(enabledTypes).toContain('vacation');
        expect(enabledTypes).toContain('sickLeave');
        expect(enabledTypes).toContain('floatingHoliday');
        expect(enabledTypes).toContain('paidHoliday');
      });
    });

    describe('Default brand (leave management disabled)', () => {
      it('should return empty array when leave management is disabled', () => {
        const enabledTypes = getEnabledLeaveTypes(DEFAULT_BRAND_FEATURES);
        expect(enabledTypes).toHaveLength(0);
        expect(enabledTypes).toEqual([]);
      });
    });

    describe('Edge cases', () => {
      it('should return empty array when leaveTypes is undefined', () => {
        const featuresWithoutTypes: BrandFeatures = {
          brandId: 'Test',
          features: {
            leaveManagement: { enabled: true },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        };
        const enabledTypes = getEnabledLeaveTypes(featuresWithoutTypes);
        expect(enabledTypes).toHaveLength(0);
      });

      it('should only return enabled leave types', () => {
        const mixedFeatures: BrandFeatures = {
          brandId: 'Test',
          features: {
            leaveManagement: {
              enabled: true,
              leaveTypes: {
                vacation: { enabled: true },
                sickLeave: { enabled: false },
                floatingHoliday: { enabled: true },
              },
            },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        };
        const enabledTypes = getEnabledLeaveTypes(mixedFeatures);
        expect(enabledTypes).toHaveLength(2);
        expect(enabledTypes).toContain('vacation');
        expect(enabledTypes).toContain('floatingHoliday');
        expect(enabledTypes).not.toContain('sickLeave');
      });
    });
  });

  describe('Brand Configuration Scenarios', () => {
    describe('NFL brand - Full leave management suite', () => {
      it('should support complete leave management workflow', () => {
        // NFL brand should have all features for leave management
        expect(isFeatureEnabled(NFL_FEATURES, 'leaveManagement')).toBe(true);
        expect(isFeatureEnabled(NFL_FEATURES, 'approvalWorkflows')).toBe(true);
        expect(isFeatureEnabled(NFL_FEATURES, 'policyEnforcement')).toBe(true);
        expect(isFeatureEnabled(NFL_FEATURES, 'accrualCalculations')).toBe(true);

        // All leave types should be available
        const leaveTypes = getEnabledLeaveTypes(NFL_FEATURES);
        expect(leaveTypes.length).toBeGreaterThan(0);
      });
    });

    describe('Default brand - Basic attendance only', () => {
      it('should work without any leave management features', () => {
        // Default brand should have all advanced features disabled
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'leaveManagement')).toBe(false);
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'approvalWorkflows')).toBe(false);
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'policyEnforcement')).toBe(false);
        expect(isFeatureEnabled(DEFAULT_BRAND_FEATURES, 'accrualCalculations')).toBe(false);

        // No leave types should be available
        const leaveTypes = getEnabledLeaveTypes(DEFAULT_BRAND_FEATURES);
        expect(leaveTypes).toHaveLength(0);
      });

      it('should be a valid BrandFeatures object', () => {
        // Verify the structure is correct
        expect(DEFAULT_BRAND_FEATURES).toHaveProperty('brandId');
        expect(DEFAULT_BRAND_FEATURES).toHaveProperty('features');
        expect(DEFAULT_BRAND_FEATURES.features).toHaveProperty('leaveManagement');
        expect(DEFAULT_BRAND_FEATURES.features).toHaveProperty('approvalWorkflows');
        expect(DEFAULT_BRAND_FEATURES.features).toHaveProperty('policyEnforcement');
        expect(DEFAULT_BRAND_FEATURES.features).toHaveProperty('accrualCalculations');
      });
    });

    describe('Other brands (BT, TRL, SBS) - Same as Default', () => {
      const OTHER_BRANDS: BrandFeatures[] = [
        {
          brandId: 'BT',
          features: {
            leaveManagement: { enabled: false },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        },
        {
          brandId: 'TRL',
          features: {
            leaveManagement: { enabled: false },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        },
        {
          brandId: 'SBS',
          features: {
            leaveManagement: { enabled: false },
            approvalWorkflows: { enabled: false },
            policyEnforcement: { enabled: false },
            accrualCalculations: { enabled: false },
          },
        },
      ];

      OTHER_BRANDS.forEach((brand) => {
        it(`${brand.brandId} should have all features disabled`, () => {
          expect(isFeatureEnabled(brand, 'leaveManagement')).toBe(false);
          expect(isFeatureEnabled(brand, 'approvalWorkflows')).toBe(false);
          expect(isFeatureEnabled(brand, 'policyEnforcement')).toBe(false);
          expect(isFeatureEnabled(brand, 'accrualCalculations')).toBe(false);
          expect(getEnabledLeaveTypes(brand)).toHaveLength(0);
        });
      });
    });
  });
});
