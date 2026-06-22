import { authDb } from './db-auth';
import { getBrandFeatures } from './brand-features';

/**
 * Get an app setting by key from auth.db
 */
export async function getAppSetting(key: string): Promise<string | null> {
  const result = await authDb.execute({
    sql: 'SELECT value FROM app_settings WHERE key = ?',
    args: [key],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return (result.rows[0] as unknown as { value: string }).value;
}

/**
 * Set an app setting (upsert) in auth.db
 */
export async function setAppSetting(key: string, value: string): Promise<void> {
  await authDb.execute({
    sql: `INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP`,
    args: [key, value],
  });
}

/**
 * Get all app settings from auth.db
 */
export async function getAllAppSettings(): Promise<Record<string, string>> {
  const result = await authDb.execute('SELECT key, value FROM app_settings');
  const settings: Record<string, string> = {};

  for (const row of result.rows) {
    const r = row as unknown as { key: string; value: string };
    settings[r.key] = r.value;
  }

  return settings;
}

/**
 * Get max out-of-office limit.
 * Resolution: DB override → brand-features.json default → 0 (no limit)
 */
export async function getMaxOutOfOffice(): Promise<number> {
  // Check DB first
  const dbValue = await getAppSetting('maxOutOfOffice');
  if (dbValue !== null) {
    const parsed = parseInt(dbValue, 10);
    if (!isNaN(parsed)) return parsed;
  }

  // Fall back to brand-features.json
  const features = await getBrandFeatures();
  return features.features.globalReadAccess?.maxOutOfOffice ?? 0;
}

/**
 * Get capacity bar thresholds (number of people OUT that triggers color change).
 * Resolution: DB override → brand-features.json default → hardcoded defaults
 * warningCount: bar turns yellow when this many staff are out (default 3)
 * criticalCount: bar turns red when this many staff are out (default 5)
 */
export async function getCapacityThresholds(): Promise<{ warningCount: number; criticalCount: number }> {
  const features = await getBrandFeatures();
  const brandWarning = features.features.globalReadAccess?.capacityWarningCount ?? 3;
  const brandCritical = features.features.globalReadAccess?.capacityCriticalCount ?? 5;

  const dbWarning = await getAppSetting('capacityWarningCount');
  const dbCritical = await getAppSetting('capacityCriticalCount');

  const warningCount = dbWarning !== null ? parseInt(dbWarning, 10) : brandWarning;
  const criticalCount = dbCritical !== null ? parseInt(dbCritical, 10) : brandCritical;

  return {
    warningCount: isNaN(warningCount) ? 3 : warningCount,
    criticalCount: isNaN(criticalCount) ? 5 : criticalCount,
  };
}
