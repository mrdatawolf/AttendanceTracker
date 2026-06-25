import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { db } from '@/lib/db-sqlite';
import { getBrandTimeCodes, getBrandTimeCodeByCode, getAccrualRuleForTimeCode } from '@/lib/brand-time-codes';
import { calculateAccrual, AccrualResult, AccrualRule } from '@/lib/accrual-calculations';

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
    const employeeId = searchParams.get('employeeId');
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get employee's hire date, rehire date, and employment type for accrual calculations
    const employeeResult = await db.execute({
      sql: 'SELECT date_of_hire, rehire_date, employment_type, is_salaried_psl FROM employees WHERE id = ?',
      args: [parseInt(employeeId)]
    });
    const hireDate = employeeResult.rows.length > 0
      ? (employeeResult.rows[0] as any).date_of_hire
      : null;
    const rehireDate = employeeResult.rows.length > 0
      ? (employeeResult.rows[0] as any).rehire_date
      : null;
    const employmentType = employeeResult.rows.length > 0
      ? (employeeResult.rows[0] as any).employment_type
      : null;
    const isSalariedPsl = employeeResult.rows.length > 0
      ? (employeeResult.rows[0] as any).is_salaried_psl
      : 0;

    // Try to get time codes from brand JSON first
    const brandTimeCodes = getBrandTimeCodes();
    const targetYear = parseInt(year);
    const asOfDate = new Date();

    // Get employee-specific allocations for this year
    const allocationsResult = await db.execute({
      sql: `SELECT time_code, time_code_id, allocated_hours, notes
            FROM employee_time_allocations
            WHERE employee_id = ? AND year = ?`,
      args: [parseInt(employeeId), targetYear]
    });

    let allocations;

    if (brandTimeCodes) {
      // Use brand-specific time codes from JSON (skip legend-only spacers)
      allocations = brandTimeCodes.filter(tc => !tc.spacer).map((tc) => {
        const override = allocationsResult.rows.find((a: any) => a.time_code_id === tc.id);

        // Check for accrual rules for this time code
        const accrualRule = getAccrualRuleForTimeCode(tc.code);
        let accrualDetails: AccrualResult | null = null;
        let allocatedHours = override ? (override as any).allocated_hours : tc.default_allocation;

        // Only calculate from hire date when no manual override exists.
        // A manual override (set per-employee in the allocations table) always takes precedence.
        if (!override && accrualRule && hireDate) {
          // Rules that reset on rehire (e.g. floating holiday) anchor to the
          // rehire date instead of the original hire date.
          const anchorDate = (accrualRule as AccrualRule).resetOnRehire && rehireDate ? rehireDate : hireDate;
          // Calculate accrued hours based on rules
          accrualDetails = calculateAccrual(
            anchorDate,
            targetYear,
            asOfDate,
            accrualRule as AccrualRule,
            employmentType
          );
          // Use accrued hours instead of static allocation
          allocatedHours = accrualDetails.accruedHours;
        }

        return {
          time_code: tc.code,
          time_code_id: tc.id,
          description: tc.description,
          default_allocation: tc.default_allocation,
          allocated_hours: allocatedHours,
          is_override: !!override,
          is_accrual: !override && !!accrualRule,
          accrual_details: accrualDetails,
          is_salaried_psl: isSalariedPsl,
          notes: override ? (override as any).notes : null
        };
      });
    } else {
      // Fall back to database
      const timeCodesResult = await db.execute(
        'SELECT id, code, description, default_allocation FROM time_codes WHERE is_active = 1 ORDER BY code'
      );

      allocations = timeCodesResult.rows.map((tc: any) => {
        const override = allocationsResult.rows.find((a: any) => a.time_code_id === tc.id);

        // Check for accrual rules for this time code
        const accrualRule = getAccrualRuleForTimeCode(tc.code);
        let accrualDetails: AccrualResult | null = null;
        let allocatedHours = override ? override.allocated_hours : tc.default_allocation;

        // Manual override takes precedence over accrual calculation
        if (!override && accrualRule && hireDate) {
          // Rules that reset on rehire (e.g. floating holiday) anchor to the
          // rehire date instead of the original hire date.
          const anchorDate = (accrualRule as AccrualRule).resetOnRehire && rehireDate ? rehireDate : hireDate;
          // Calculate accrued hours based on rules
          accrualDetails = calculateAccrual(
            anchorDate,
            targetYear,
            asOfDate,
            accrualRule as AccrualRule,
            employmentType
          );
          // Use accrued hours instead of static allocation
          allocatedHours = accrualDetails.accruedHours;
        }

        return {
          time_code: tc.code,
          time_code_id: tc.id,
          description: tc.description,
          default_allocation: tc.default_allocation,
          allocated_hours: allocatedHours,
          is_override: !!override,
          is_accrual: !override && !!accrualRule,
          accrual_details: accrualDetails,
          is_salaried_psl: isSalariedPsl,
          notes: override?.notes || null
        };
      });
    }

    return NextResponse.json({
      employee_id: parseInt(employeeId),
      year: targetYear,
      hire_date: hireDate,
      allocations
    });
  } catch (error) {
    console.error('Error fetching employee allocations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee allocations' },
      { status: 500 }
    );
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

    // Only users with edit permissions can modify allocations
    if (!authUser.group?.is_master && !authUser.group?.can_edit_all) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify allocations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employee_id, time_code, allocated_hours, year, notes } = body;

    if (!employee_id || !time_code || allocated_hours === undefined || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try to look up time_code_id from brand JSON first
    const brandTimeCode = getBrandTimeCodeByCode(time_code);
    let timeCodeId: number;

    if (brandTimeCode) {
      timeCodeId = brandTimeCode.id;
    } else {
      // Fall back to database lookup
      const timeCodeResult = await db.execute({
        sql: 'SELECT id FROM time_codes WHERE code = ?',
        args: [time_code]
      });

      if (timeCodeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid time code' },
          { status: 400 }
        );
      }

      timeCodeId = (timeCodeResult.rows[0] as any).id;
    }

    // Insert or update allocation
    await db.execute({
      sql: `INSERT INTO employee_time_allocations (employee_id, time_code, time_code_id, allocated_hours, year, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, time_code, year)
            DO UPDATE SET time_code_id = ?, allocated_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP`,
      args: [
        employee_id,
        time_code,
        timeCodeId,
        allocated_hours,
        year,
        notes || null,
        timeCodeId,
        allocated_hours,
        notes || null
      ]
    });

    return NextResponse.json({
      success: true,
      message: 'Allocation updated successfully'
    });
  } catch (error) {
    console.error('Error updating employee allocation:', error);
    return NextResponse.json(
      { error: 'Failed to update allocation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only users with edit permissions can delete allocations
    if (!authUser.group?.is_master && !authUser.group?.can_edit_all) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify allocations' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const timeCode = searchParams.get('timeCode');
    const year = searchParams.get('year');

    if (!employeeId || !timeCode || !year) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Try to look up time_code_id from brand JSON first
    const brandTimeCode = getBrandTimeCodeByCode(timeCode);
    let timeCodeId: number;

    if (brandTimeCode) {
      timeCodeId = brandTimeCode.id;
    } else {
      // Fall back to database lookup
      const timeCodeResult = await db.execute({
        sql: 'SELECT id FROM time_codes WHERE code = ?',
        args: [timeCode]
      });

      if (timeCodeResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid time code' },
          { status: 400 }
        );
      }

      timeCodeId = (timeCodeResult.rows[0] as any).id;
    }

    // Delete the allocation (will revert to default)
    await db.execute({
      sql: `DELETE FROM employee_time_allocations
            WHERE employee_id = ? AND time_code_id = ? AND year = ?`,
      args: [parseInt(employeeId), timeCodeId, parseInt(year)]
    });

    return NextResponse.json({
      success: true,
      message: 'Allocation reverted to default'
    });
  } catch (error) {
    console.error('Error deleting employee allocation:', error);
    return NextResponse.json(
      { error: 'Failed to delete allocation' },
      { status: 500 }
    );
  }
}
