import { NextResponse } from 'next/server';
import { getAllTimeCodes, syncTimeCodesFromJson } from '@/lib/queries-sqlite';
import { getBrandTimeCodes } from '@/lib/brand-time-codes';

export async function GET() {
  try {
    // Get ALL time codes (including inactive) for syncing to database
    const allTimeCodes = getBrandTimeCodes(undefined, true);

    if (allTimeCodes) {
      // Sync ALL time codes to database (ensures is_active status is updated)
      try {
        const syncResult = await syncTimeCodesFromJson(allTimeCodes);
        if (syncResult.inserted > 0 || syncResult.updated > 0) {
          console.log(`Time codes synced: ${syncResult.inserted} inserted, ${syncResult.updated} updated`);
        }
      } catch (syncError) {
        console.error('Error syncing time codes to database:', syncError);
        // Continue even if sync fails - we can still return the JSON data
      }

      // Return only ACTIVE time codes for display
      const activeTimeCodes = getBrandTimeCodes();
      if (activeTimeCodes) {
        const timeCodes = activeTimeCodes
          .filter(tc => !tc.spacer)
          .map(tc => ({
            id: tc.id,
            code: tc.code,
            description: tc.description,
            hours_limit: tc.hours_limit ?? undefined,
            is_active: tc.is_active,
          }));
        return NextResponse.json(timeCodes);
      }
    }

    // Fall back to database if no JSON file exists
    const timeCodes = await getAllTimeCodes();
    return NextResponse.json(timeCodes);
  } catch (error) {
    console.error('Error fetching time codes:', error);
    return NextResponse.json({ error: 'Failed to fetch time codes' }, { status: 500 });
  }
}
