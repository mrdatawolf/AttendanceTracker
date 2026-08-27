import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  getEmployeeAccrualRule,
  getEmployeeAccrualRules,
  setEmployeeAccrualRule,
  deleteEmployeeAccrualRule,
} from '@/lib/employee-accrual-rules';
import type { AccrualRule } from '@/lib/accrual-calculations';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const timeCode = searchParams.get('timeCode');

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    if (timeCode) {
      const rule = await getEmployeeAccrualRule(parseInt(employeeId), timeCode);
      return NextResponse.json({ employee_id: parseInt(employeeId), time_code: timeCode, rule });
    }

    const rules = await getEmployeeAccrualRules(parseInt(employeeId));
    return NextResponse.json({ employee_id: parseInt(employeeId), rules });
  } catch (error) {
    console.error('Error fetching employee accrual rules:', error);
    return NextResponse.json({ error: 'Failed to fetch employee accrual rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Same permission bar as employee-allocations: this changes how much
    // paid time off an employee is entitled to.
    if (!authUser.group?.is_master && !authUser.group?.can_edit_all) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify accrual rules' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employee_id, time_code, rule, notes } = body as {
      employee_id?: number;
      time_code?: string;
      rule?: AccrualRule;
      notes?: string;
    };

    if (!employee_id || !time_code || !rule) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!rule.type) {
      return NextResponse.json({ error: 'rule.type is required' }, { status: 400 });
    }

    await setEmployeeAccrualRule(employee_id, time_code, rule, notes);

    return NextResponse.json({ success: true, message: 'Accrual rule saved' });
  } catch (error) {
    console.error('Error saving employee accrual rule:', error);
    return NextResponse.json({ error: 'Failed to save accrual rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!authUser.group?.is_master && !authUser.group?.can_edit_all) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify accrual rules' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const timeCode = searchParams.get('timeCode');

    if (!employeeId || !timeCode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    await deleteEmployeeAccrualRule(parseInt(employeeId), timeCode);

    return NextResponse.json({ success: true, message: 'Accrual rule removed' });
  } catch (error) {
    console.error('Error deleting employee accrual rule:', error);
    return NextResponse.json({ error: 'Failed to delete accrual rule' }, { status: 500 });
  }
}
