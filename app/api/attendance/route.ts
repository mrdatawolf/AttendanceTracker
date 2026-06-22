import { NextRequest, NextResponse } from 'next/server';
import { getAllEntries, getEntriesForDateRange, upsertEntry, deleteEntry, getEmployeeById, syncTimeCodesFromJson } from '@/lib/queries-sqlite';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import {
  logAudit,
  canUserExplicitlyReadGroup,
  canUserExplicitlyUpdateGroup,
  canUserExplicitlyDeleteGroup,
  getExplicitReadableGroupIds,
  isSuperuser,
} from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { serializeBigInt } from '@/lib/utils';
import { getBrandTimeCodes, getAccrualRuleForTimeCode } from '@/lib/brand-time-codes';
import { getBrandFeatures, getBulkEntryConfig } from '@/lib/brand-features';
import { calculateAccrual, AccrualRule } from '@/lib/accrual-calculations';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Permission helpers
    const userIsSuperuser = await isSuperuser(authUser.id);
    const hasFullAccess = userIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;

    // If no employeeId is provided, return entries scoped to what the user can see
    if (!employeeIdParam) {
      const yearStartDate = startDate || `${year}-01-01`;
      const yearEndDate = endDate || `${year}-12-31`;

      if (hasFullAccess) {
        const entries = await getAllEntries(yearStartDate, yearEndDate);
        return NextResponse.json(serializeBigInt(entries));
      }

      // Non-full-access users: return entries for their visible employees only
      const readableGroupIds = await getExplicitReadableGroupIds(authUser.id);
      const ownEmployeeId = authUser.employee_id;

      const groupConditions: string[] = [];
      const conditionArgs: (string | number)[] = [];

      if (readableGroupIds.length > 0) {
        groupConditions.push(`e.group_id IN (${readableGroupIds.map(() => '?').join(',')})`);
        conditionArgs.push(...readableGroupIds);
      }
      if (ownEmployeeId) {
        groupConditions.push('ae.employee_id = ?');
        conditionArgs.push(ownEmployeeId);
      }

      if (groupConditions.length === 0) {
        return NextResponse.json(serializeBigInt([]));
      }

      const result = await db.execute({
        sql: `SELECT ae.* FROM attendance_entries ae
              LEFT JOIN employees e ON ae.employee_id = e.id
              WHERE ae.entry_date >= ? AND ae.entry_date <= ?
              AND (${groupConditions.join(' OR ')})
              ORDER BY ae.entry_date DESC`,
        args: [yearStartDate, yearEndDate, ...conditionArgs],
      });
      return NextResponse.json(serializeBigInt(result.rows));
    }

    const employeeId = parseInt(employeeIdParam);

    // Check if user can view this employee's data
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Permission check: own employee, full access, or explicit group permission
    if (!hasFullAccess && employee.group_id) {
      const isOwnEmployee = authUser.employee_id === employeeId;
      if (!isOwnEmployee) {
        const canView = await canUserExplicitlyReadGroup(authUser.id, employee.group_id);
        if (!canView) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to view this employee\'s attendance' },
            { status: 403 }
          );
        }
      }
    }

    let entries;
    if (startDate && endDate) {
      entries = await getEntriesForDateRange(employeeId, startDate, endDate);
    } else {
      const yearStartDate = `${year}-01-01`;
      const yearEndDate = `${year}-12-31`;
      entries = await getEntriesForDateRange(employeeId, yearStartDate, yearEndDate);
    }

    return NextResponse.json(serializeBigInt(entries));
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ensure time codes from brand JSON are synced to database (include inactive for proper sync)
    const brandTimeCodes = getBrandTimeCodes(undefined, true);
    if (brandTimeCodes) {
      await syncTimeCodesFromJson(brandTimeCodes);
    }

    const body = await request.json();

    // Check if user can edit this employee's data
    const employee = await getEmployeeById(body.employee_id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Permission check: own employee always allowed, otherwise check explicit permissions
    const userIsSuperuser = await isSuperuser(authUser.id);
    const hasFullAccess = userIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;
    const isOwnEmployee = authUser.employee_id === body.employee_id;

    if (!hasFullAccess && !isOwnEmployee && employee.group_id) {
      if (body.action === 'delete') {
        const canDelete = await canUserExplicitlyDeleteGroup(authUser.id, employee.group_id);
        if (!canDelete) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to delete this employee\'s attendance' },
            { status: 403 }
          );
        }
      } else {
        const canUpdate = await canUserExplicitlyUpdateGroup(authUser.id, employee.group_id);
        if (!canUpdate) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to edit this employee\'s attendance' },
            { status: 403 }
          );
        }
      }
    }

    if (body.action === 'bulk_update_range') {
      // Bulk entry: apply a single time code across a date range
      const { start_date, end_date, time_code, hours, notes, skip_weekends, overwrite_existing, over_limit_acknowledged } = body;

      if (!start_date || !end_date || !time_code) {
        return NextResponse.json({ error: 'start_date, end_date, and time_code are required' }, { status: 400 });
      }

      if (new Date(end_date) < new Date(start_date)) {
        return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 });
      }

      const hoursPerDay = hours || 8;
      if (hoursPerDay <= 0 || hoursPerDay > 24) {
        return NextResponse.json({ error: 'Hours per day must be between 0 and 24' }, { status: 400 });
      }

      // Generate list of dates in range
      const dates: string[] = [];
      const current = new Date(start_date + 'T00:00:00');
      const last = new Date(end_date + 'T00:00:00');
      while (current <= last) {
        const dayOfWeek = current.getDay();
        if (!skip_weekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
        }
        current.setDate(current.getDate() + 1);
      }

      // Validate against maxDays
      const features = await getBrandFeatures();
      const bulkConfig = getBulkEntryConfig(features);
      if (dates.length > bulkConfig.maxDays) {
        return NextResponse.json({
          error: 'range_too_large',
          message: `Date range covers ${dates.length} days, which exceeds the maximum of ${bulkConfig.maxDays} days`,
          dayCount: dates.length,
          maxDays: bulkConfig.maxDays,
        }, { status: 400 });
      }

      // Resolve the effective hour cap for this time code
      // Priority: hours_limit > accrual allocation > employee override > default_allocation
      const allTimeCodes = getBrandTimeCodes(undefined, true);
      const tcDef = allTimeCodes?.find(tc => tc.code === time_code);
      let effectiveLimit: number | null = tcDef?.hours_limit ?? null;

      if (effectiveLimit === null && tcDef) {
        // No hard hours_limit — check accrual rules and allocations
        const accrualRule = getAccrualRuleForTimeCode(time_code);
        const entryYear = new Date(start_date + 'T00:00:00').getFullYear();

        if (accrualRule) {
          // Get employee hire date, rehire date, and employment type for accrual calculation
          const empResult = await db.execute({
            sql: 'SELECT date_of_hire, rehire_date, employment_type FROM employees WHERE id = ?',
            args: [body.employee_id],
          });
          const hireDate = empResult.rows.length > 0 ? (empResult.rows[0] as any).date_of_hire : null;
          const rehireDate = empResult.rows.length > 0 ? (empResult.rows[0] as any).rehire_date : null;
          const employmentType = empResult.rows.length > 0 ? (empResult.rows[0] as any).employment_type : null;

          if (hireDate) {
            // Rules that reset on rehire (e.g. floating holiday) anchor to the
            // rehire date instead of the original hire date.
            const anchorDate = (accrualRule as AccrualRule).resetOnRehire && rehireDate ? rehireDate : hireDate;
            const accrualResult = calculateAccrual(anchorDate, entryYear, new Date(), accrualRule as AccrualRule, employmentType);
            effectiveLimit = accrualResult.accruedHours;
          }
        }

        // Check for employee-specific override
        if (effectiveLimit === null) {
          const overrideResult = await db.execute({
            sql: `SELECT allocated_hours FROM employee_time_allocations
                  WHERE employee_id = ? AND time_code = ? AND year = ?`,
            args: [body.employee_id, time_code, entryYear],
          });
          if (overrideResult.rows.length > 0) {
            effectiveLimit = Number((overrideResult.rows[0] as any).allocated_hours);
          }
        }

        // Fall back to default_allocation
        if (effectiveLimit === null && tcDef.default_allocation) {
          effectiveLimit = tcDef.default_allocation;
        }
      }

      if (effectiveLimit !== null && !over_limit_acknowledged) {
        // Sum existing usage for this time code in the same year
        const entryYear = new Date(start_date + 'T00:00:00').getFullYear();
        const usageResult = await db.execute({
          sql: `SELECT COALESCE(SUM(hours), 0) as total_used FROM attendance_entries
                WHERE employee_id = ? AND time_code = ?
                AND entry_date >= ? AND entry_date <= ?`,
          args: [body.employee_id, time_code, `${entryYear}-01-01`, `${entryYear}-12-31`],
        });
        const totalUsed = Number((usageResult.rows[0] as any).total_used) || 0;
        const requested = hoursPerDay * dates.length;
        const remaining = effectiveLimit - totalUsed;

        if (requested > remaining) {
          return NextResponse.json({
            error: 'over_limit',
            message: `This would use ${requested}h but only ${remaining.toFixed(1)}h of ${effectiveLimit}h remain for ${time_code}`,
            remaining: Math.max(0, remaining),
            requested,
            hours_limit: effectiveLimit,
            total_used: totalUsed,
          }, { status: 400 });
        }
      }

      // Process each date
      let createdCount = 0;
      let skippedCount = 0;
      const skippedDates: string[] = [];

      for (const dateStr of dates) {
        // Check for existing entries on this date
        const existing = await db.execute({
          sql: 'SELECT * FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
          args: [body.employee_id, dateStr],
        });

        if (existing.rows.length > 0 && !overwrite_existing) {
          skippedCount++;
          skippedDates.push(dateStr);
          continue;
        }

        // Delete existing entries if overwriting
        if (existing.rows.length > 0) {
          await db.execute({
            sql: 'DELETE FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
            args: [body.employee_id, dateStr],
          });
        }

        // Insert new entry
        const result = await db.execute({
          sql: `INSERT INTO attendance_entries (employee_id, entry_date, time_code, hours, notes)
                VALUES (?, ?, ?, ?, ?)`,
          args: [body.employee_id, dateStr, time_code, hoursPerDay, notes || null],
        });

        createdCount++;

        // Audit log per day
        try {
          await logAudit({
            user_id: authUser.id,
            action: existing.rows.length > 0 ? 'UPDATE' : 'CREATE',
            table_name: 'attendance_entries',
            record_id: Number(result.lastInsertRowid),
            old_values: existing.rows.length > 0 ? JSON.stringify(existing.rows) : undefined,
            new_values: JSON.stringify({ employee_id: body.employee_id, entry_date: dateStr, time_code, hours: hoursPerDay, notes: notes || null }),
            ip_address: getClientIP(request),
            user_agent: getUserAgent(request),
          });
        } catch (auditError) {
          console.error('Failed to log audit entry (non-critical):', auditError);
        }
      }

      return NextResponse.json({
        success: true,
        created_count: createdCount,
        skipped_count: skippedCount,
        skipped_dates: skippedDates,
      });
    } else if (body.action === 'update_day') {
      // Batch update: replace all entries for a specific date, optionally
      // moving them to a different date (target_entry_date) in the same call.
      // Validate total hours
      const entries = body.entries || [];
      const totalHours = entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
      if (totalHours > 24) {
        return NextResponse.json(
          { error: 'Total hours cannot exceed 24 hours per day' },
          { status: 400 }
        );
      }

      const targetEntryDate = body.target_entry_date || body.entry_date;
      const isMovingDate = targetEntryDate !== body.entry_date;

      if (isMovingDate) {
        // The target date isn't shown in this dialog, so we can't safely
        // merge with whatever might already be there — block instead of
        // risking an overwrite of unrelated entries.
        const targetExisting = await db.execute({
          sql: 'SELECT COUNT(*) as count FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
          args: [body.employee_id, targetEntryDate],
        });
        if (Number((targetExisting.rows[0] as any).count) > 0) {
          return NextResponse.json({
            error: 'date_occupied',
            message: `${targetEntryDate} already has entries. Edit that day directly instead of moving entries onto it.`,
          }, { status: 400 });
        }
      }

      // Get old entries for audit log
      const oldEntries = await db.execute({
        sql: 'SELECT * FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [body.employee_id, body.entry_date],
      });

      // Delete all existing entries for the source date
      await db.execute({
        sql: 'DELETE FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [body.employee_id, body.entry_date],
      });

      // Insert all new entries at the target date (same as source date unless moving)
      const newEntries = [];
      for (const entry of entries) {
        const result = await db.execute({
          sql: `INSERT INTO attendance_entries (employee_id, entry_date, time_code, hours, notes)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            body.employee_id,
            targetEntryDate,
            entry.time_code,
            entry.hours || 0,
            entry.notes || null,
          ],
        });
        // Convert BigInt to Number for JSON serialization
        newEntries.push({ id: Number(result.lastInsertRowid), ...entry, entry_date: targetEntryDate });
      }

      // Log audit entry (non-critical - don't fail the operation if this fails)
      try {
        await logAudit({
          user_id: authUser.id,
          action: 'UPDATE',
          table_name: 'attendance_entries',
          record_id: undefined,
          old_values: oldEntries.rows.length > 0 ? JSON.stringify(oldEntries.rows) : undefined,
          new_values: newEntries.length > 0 ? JSON.stringify(newEntries) : undefined,
          ip_address: getClientIP(request),
          user_agent: getUserAgent(request),
        });
      } catch (auditError) {
        console.error('Failed to log audit entry (non-critical):', auditError);
      }

      return NextResponse.json({ success: true, entries: serializeBigInt(newEntries) });
    } else if (body.action === 'delete') {
      // Get old entry for audit log
      const oldEntry = await db.execute({
        sql: 'SELECT * FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [body.employee_id, body.entry_date],
      });

      await deleteEntry(body.employee_id, body.entry_date);

      // Log audit entry (non-critical - don't fail the operation if this fails)
      if (oldEntry.rows.length > 0) {
        try {
          await logAudit({
            user_id: authUser.id,
            action: 'DELETE',
            table_name: 'attendance_entries',
            record_id: (oldEntry.rows[0] as any).id,
            old_values: JSON.stringify(oldEntry.rows[0]),
            ip_address: getClientIP(request),
            user_agent: getUserAgent(request),
          });
        } catch (auditError) {
          console.error('Failed to log audit entry (non-critical):', auditError);
        }
      }
    } else {
      // Check if entry exists for audit log
      const existing = await db.execute({
        sql: 'SELECT * FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [body.employee_id, body.entry_date],
      });

      const isUpdate = existing.rows.length > 0;

      await upsertEntry({
        employee_id: body.employee_id,
        entry_date: body.entry_date,
        time_code: body.time_code,
        hours: body.hours || 0,
        notes: body.notes,
        time_code_id: 0
      });

      // Get the new entry
      const newEntry = await db.execute({
        sql: 'SELECT * FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [body.employee_id, body.entry_date],
      });

      // Log audit entry (non-critical - don't fail the operation if this fails)
      try {
        await logAudit({
          user_id: authUser.id,
          action: isUpdate ? 'UPDATE' : 'CREATE',
          table_name: 'attendance_entries',
          record_id: (newEntry.rows[0] as any)?.id,
          old_values: isUpdate ? JSON.stringify(existing.rows[0]) : undefined,
          new_values: JSON.stringify(newEntry.rows[0]),
          ip_address: getClientIP(request),
          user_agent: getUserAgent(request),
        });
      } catch (auditError) {
        console.error('Failed to log audit entry (non-critical):', auditError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating attendance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update attendance';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Full error details:', { errorMessage, errorStack });
    return NextResponse.json({
      error: 'Failed to update attendance',
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}
