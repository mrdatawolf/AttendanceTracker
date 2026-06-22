import fs from 'fs';
import path from 'path';
import { getCurrentBrand } from './brand-time-codes';

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportExportConfig {
  csv: boolean;
  pdf: boolean;
  filename: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  apiEndpoint: string;
  isDefault?: boolean;
  requiredFeature?: string;
  columns: ReportColumn[];
  export: ReportExportConfig;
}

interface ReportDefinitionsFile {
  brandId: string;
  version: string;
  description: string;
  reports: ReportDefinition[];
}

/**
 * Load report definitions from brand-specific JSON file
 * Falls back to Default brand if no brand-specific file exists
 */
export function getBrandReportDefinitions(brand?: string): ReportDefinition[] {
  const targetBrand = brand || getCurrentBrand();

  // Try brand-specific first
  try {
    const brandPath = path.join(process.cwd(), 'public', targetBrand, 'reports', 'report-definitions.json');
    if (fs.existsSync(brandPath)) {
      const data: ReportDefinitionsFile = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
      return data.reports;
    }
  } catch (error) {
    console.error(`Error reading report definitions for brand ${targetBrand}:`, error);
  }

  // Fall back to Default
  try {
    const defaultPath = path.join(process.cwd(), 'public', 'Default', 'reports', 'report-definitions.json');
    if (fs.existsSync(defaultPath)) {
      const data: ReportDefinitionsFile = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
      return data.reports;
    }
  } catch (error) {
    console.error('Error reading default report definitions:', error);
  }

  return [];
}

/**
 * Get a specific report definition by ID
 */
export function getReportDefinitionById(reportId: string, brand?: string): ReportDefinition | null {
  const reports = getBrandReportDefinitions(brand);
  return reports.find(r => r.id === reportId) || null;
}

/**
 * Get the default report for a brand
 */
export function getDefaultReport(brand?: string): ReportDefinition | null {
  const reports = getBrandReportDefinitions(brand);
  return reports.find(r => r.isDefault) || reports[0] || null;
}
