import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { setUserEmployeeId, logAudit } from '@/lib/queries-auth';
import { authDb } from '@/lib/db-auth';
import { getAllEmployees, createEmployee } from '@/lib/queries-sqlite';
import { db } from '@/lib/db-sqlite';
import { serializeBigInt } from '@/lib/utils';
import { getBrandFeatures, isAutoGenerateAbbreviation } from '@/lib/brand-features';
import { generateUniqueAbbreviation } from '@/lib/abbreviation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user-employee-link
 *
 * Returns employees available for the current user to link to.
 * Filters to user's group and excludes employees already linked to other users.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active employees
    let employees = await getAllEmployees();
    employees = employees.filter(emp => emp.is_active === 1);

    // Filter to user's group if they have one (also include unassigned employees)
    if (authUser.group_id) {
      employees = employees.filter(emp => !emp.group_id || emp.group_id === authUser.group_id);
    }

    // Get employee IDs already linked to other users
    const linkedResult = await authDb.execute({
      sql: 'SELECT employee_id FROM users WHERE employee_id IS NOT NULL AND id != ?',
      args: [authUser.id],
    });
    const linkedEmployeeIds = new Set(
      linkedResult.rows.map((row: any) => Number(row.employee_id))
    );

    // Filter out already-linked employees
    const availableEmployees = employees.filter(emp => !linkedEmployeeIds.has(emp.id));

    return NextResponse.json({
      employees: serializeBigInt(availableEmployees),
      user: {
        id: authUser.id,
        full_name: authUser.full_name,
        email: authUser.email,
        group_id: authUser.group_id,
      },
    });
  } catch (error) {
    console.error('Error fetching linkable employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-employee-link
 *
 * Link the current user to an employee.
 * Body: { employeeId: number } OR { createNew: true, firstName, lastName, email? }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    let employeeId: number;

    if (body.createNew) {
      // Create a new employee and link
      const { firstName, lastName, email } = body;

      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: 'firstName and lastName are required' },
          { status: 400 }
        );
      }

      const resolvedEmail = email || authUser.email || undefined;

      // Check for a soft-deleted employee with the same email — reactivate instead of failing
      if (resolvedEmail) {
        const existing = await db.execute({
          sql: 'SELECT id FROM employees WHERE email = ? AND is_active = 0',
          args: [resolvedEmail],
        });

        if (existing.rows.length > 0) {
          // Reactivate the soft-deleted employee
          const existingId = Number((existing.rows[0] as unknown as { id: number }).id);
          await db.execute({
            sql: `UPDATE employees
                  SET first_name = ?, last_name = ?, email = ?, group_id = ?,
                      is_active = 1, created_by = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
            args: [firstName, lastName, resolvedEmail, authUser.group_id, authUser.id, existingId],
          });
          employeeId = existingId;

          await logAudit({
            user_id: authUser.id,
            action: 'REACTIVATE',
            table_name: 'employees',
            record_id: employeeId,
            new_values: JSON.stringify({
              first_name: firstName,
              last_name: lastName,
              email: resolvedEmail,
              group_id: authUser.group_id,
              linked_to_user: authUser.id,
            }),
            ip_address: getClientIP(request),
            user_agent: getUserAgent(request),
          });

          // Auto-generate abbreviation if feature is on and employee has none
          const reactivatedRow = await db.execute({
            sql: 'SELECT abbreviation FROM employees WHERE id = ?',
            args: [existingId],
          });
          if (!(reactivatedRow.rows[0] as any)?.abbreviation) {
            const brandFeatures = await getBrandFeatures();
            if (isAutoGenerateAbbreviation(brandFeatures)) {
              const existingAbbrs = await db.execute({
                sql: 'SELECT abbreviation FROM employees WHERE abbreviation IS NOT NULL AND is_active = 1 AND id != ?',
                args: [existingId],
              });
              const existingSet = new Set<string>(
                (existingAbbrs.rows as any[]).map(r => String(r.abbreviation).toUpperCase())
              );
              const abbr = generateUniqueAbbreviation(firstName, lastName, existingSet);
              if (abbr) {
                await db.execute({
                  sql: 'UPDATE employees SET abbreviation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  args: [abbr, existingId],
                });
              }
            }
          }

          // Link and return early
          await setUserEmployeeId(authUser.id, employeeId);

          await logAudit({
            user_id: authUser.id,
            action: 'UPDATE',
            table_name: 'users',
            record_id: authUser.id,
            old_values: JSON.stringify({ employee_id: authUser.employee_id }),
            new_values: JSON.stringify({ employee_id: employeeId }),
            ip_address: getClientIP(request),
            user_agent: getUserAgent(request),
          });

          return NextResponse.json({
            success: true,
            employee_id: employeeId,
            user: {
              id: authUser.id,
              username: authUser.username,
              full_name: authUser.full_name,
              email: authUser.email,
              group_id: authUser.group_id,
              role_id: authUser.role_id,
              employee_id: employeeId,
              is_superuser: authUser.is_superuser,
              group: authUser.group,
              role: authUser.role,
            },
          });
        }
      }

      // Auto-generate abbreviation if brand feature is enabled
      let autoAbbreviation: string | undefined;
      const brandFeaturesForNew = await getBrandFeatures();
      if (isAutoGenerateAbbreviation(brandFeaturesForNew)) {
        const existingAbbrs = await db.execute({
          sql: 'SELECT abbreviation FROM employees WHERE abbreviation IS NOT NULL AND is_active = 1',
          args: [],
        });
        const existingSet = new Set<string>(
          (existingAbbrs.rows as any[]).map(r => String(r.abbreviation).toUpperCase())
        );
        autoAbbreviation = generateUniqueAbbreviation(firstName, lastName, existingSet) || undefined;
      }

      const newEmployee = await createEmployee({
        employee_number: undefined,
        first_name: firstName,
        last_name: lastName,
        email: resolvedEmail,
        role: 'employee',
        group_id: authUser.group_id,
        date_of_hire: undefined,
        rehire_date: undefined,
        employment_type: 'full_time',
        seniority_rank: undefined,
        abbreviation: autoAbbreviation,
        created_by: authUser.id,
        is_active: 1,
      });

      employeeId = newEmployee.id;

      await logAudit({
        user_id: authUser.id,
        action: 'CREATE',
        table_name: 'employees',
        record_id: employeeId,
        new_values: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: resolvedEmail,
          group_id: authUser.group_id,
          linked_to_user: authUser.id,
        }),
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });
    } else if (body.employeeId) {
      employeeId = Number(body.employeeId);

      // Verify employee exists
      const employees = await getAllEmployees();
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Verify not already linked to another user
      const linkedResult = await authDb.execute({
        sql: 'SELECT id, username FROM users WHERE employee_id = ? AND id != ?',
        args: [employeeId, authUser.id],
      });
      if (linkedResult.rows.length > 0) {
        return NextResponse.json(
          { error: 'This employee is already linked to another user' },
          { status: 409 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either employeeId or createNew is required' },
        { status: 400 }
      );
    }

    // Link user to employee
    await setUserEmployeeId(authUser.id, employeeId);

    await logAudit({
      user_id: authUser.id,
      action: 'UPDATE',
      table_name: 'users',
      record_id: authUser.id,
      old_values: JSON.stringify({ employee_id: authUser.employee_id }),
      new_values: JSON.stringify({ employee_id: employeeId }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    // Return the updated user info so the client can refresh
    // Re-fetch via getAuthUser would require the request again, so just patch the response
    return NextResponse.json({
      success: true,
      employee_id: employeeId,
      user: {
        ...{
          id: authUser.id,
          username: authUser.username,
          full_name: authUser.full_name,
          email: authUser.email,
          group_id: authUser.group_id,
          role_id: authUser.role_id,
          employee_id: employeeId,
          is_superuser: authUser.is_superuser,
          group: authUser.group,
          role: authUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Error linking employee:', error);
    return NextResponse.json(
      { error: 'Failed to link employee' },
      { status: 500 }
    );
  }
}
