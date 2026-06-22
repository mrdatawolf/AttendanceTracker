import { NextRequest, NextResponse } from 'next/server';
import { getAllEmployees, createEmployee, getEmployeeById } from '@/lib/queries-sqlite';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import {
  logAudit,
  getExplicitReadableGroupIds,
  canUserExplicitlyReadGroup,
  canUserCreateInGroup,
  canUserUpdateInGroup,
  canUserDeleteInGroup,
  isSuperuser,
  setUserEmployeeId,
  clearEmployeeIdByEmployee,
} from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { serializeBigInt } from '@/lib/utils';
import { getBrandFeatures, isAutoGenerateAbbreviation } from '@/lib/brand-features';
import { generateUniqueAbbreviation } from '@/lib/abbreviation';

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
    const employeeId = searchParams.get('id');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Permission helpers
    const userIsSuperuser = await isSuperuser(authUser.id);
    const hasFullAccess = userIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;

    if (employeeId) {
      const employee = await getEmployeeById(parseInt(employeeId));
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Permission check: own employee, full access, or explicit group permission
      if (!hasFullAccess && employee.group_id) {
        const isOwnEmployee = authUser.employee_id === employee.id;
        if (!isOwnEmployee) {
          const canView = await canUserExplicitlyReadGroup(authUser.id, employee.group_id);
          if (!canView) {
            return NextResponse.json(
              { error: 'Forbidden: You do not have permission to view this employee' },
              { status: 403 }
            );
          }
        }
      }

      return NextResponse.json(serializeBigInt(employee));
    } else {
      // Get all employees (filter based on permissions)
      const allEmployees = await getAllEmployees();

      // Filter out inactive employees unless includeInactive is true
      // Only superusers can see inactive employees
      let activeEmployees = allEmployees;
      if (!includeInactive || !userIsSuperuser) {
        activeEmployees = allEmployees.filter(emp => emp.is_active === 1);
      }

      // Filter employees based on explicit permissions (no auto-own-group)
      let employees = activeEmployees;
      if (!hasFullAccess) {
        const readableGroupIds = await getExplicitReadableGroupIds(authUser.id);
        employees = activeEmployees.filter(emp => {
          // Always include user's own linked employee
          if (authUser.employee_id && emp.id === authUser.employee_id) return true;
          // Include employees in explicitly permitted groups
          return emp.group_id && readableGroupIds.includes(emp.group_id);
        });
      }

      // Auto-create employee for user if they're the first in their group
      // Check against unfiltered active list so permission filtering doesn't trigger false positives
      if (!userIsSuperuser && authUser.group_id) {
        const employeesInUserGroup = activeEmployees.filter(emp => emp.group_id === authUser.group_id);
        if (employeesInUserGroup.length === 0) {
          // No employees in user's group - create one for the user
          // Parse full_name into first_name and last_name
          const nameParts = authUser.full_name.trim().split(/\s+/);
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || authUser.username;

          const newEmployee = await createEmployee({
            employee_number: undefined,
            first_name: firstName,
            last_name: lastName,
            email: authUser.email || undefined,
            role: 'employee',
            group_id: authUser.group_id,
            date_of_hire: undefined,
            rehire_date: undefined,
            employment_type: 'full_time',
            seniority_rank: undefined,
            created_by: authUser.id,
            is_active: 1
          });

          // Link the auto-created employee to the user
          try {
            await setUserEmployeeId(authUser.id, newEmployee.id);
          } catch (linkError) {
            console.error('Failed to link auto-created employee to user (non-critical):', linkError);
          }

          // Log audit entry for auto-created employee
          await logAudit({
            user_id: authUser.id,
            action: 'CREATE',
            table_name: 'employees',
            record_id: newEmployee.id,
            new_values: JSON.stringify({
              first_name: newEmployee.first_name,
              last_name: newEmployee.last_name,
              email: newEmployee.email,
              group_id: newEmployee.group_id,
              auto_created: true,
              linked_to_user: authUser.id,
            }),
            ip_address: getClientIP(request),
            user_agent: getUserAgent(request),
          });

          employees.push(newEmployee);
        }
      }

      return NextResponse.json(serializeBigInt(employees));
    }
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
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

    const body = await request.json();

    // Check if user can create employees in the specified group (Phase 2 CRUD permissions)
    const postIsSuperuser = await isSuperuser(authUser.id);
    const postHasFullAccess = postIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;

    if (!postHasFullAccess && body.group_id) {
      const canCreate = await canUserCreateInGroup(authUser.id, body.group_id);
      if (!canCreate) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to create employees in this group' },
          { status: 403 }
        );
      }
    }

    // Auto-generate abbreviation from name if brand feature is enabled and none was supplied
    if (!body.abbreviation && body.first_name && body.last_name) {
      const brandFeatures = await getBrandFeatures();
      if (isAutoGenerateAbbreviation(brandFeatures)) {
        const existingResult = await db.execute({
          sql: 'SELECT abbreviation FROM employees WHERE abbreviation IS NOT NULL AND is_active = 1',
          args: [],
        });
        const existingSet = new Set<string>(
          (existingResult.rows as any[]).map(r => String(r.abbreviation).toUpperCase())
        );
        const abbr = generateUniqueAbbreviation(body.first_name, body.last_name, existingSet);
        if (abbr) body.abbreviation = abbr;
      }
    }

    // Validate abbreviation if provided
    if (body.abbreviation) {
      const abbr = String(body.abbreviation).toUpperCase().trim();
      if (abbr.length > 3) {
        return NextResponse.json({ error: 'Abbreviation must be 3 characters or less' }, { status: 400 });
      }
      const existing = await db.execute({
        sql: 'SELECT id, is_active, first_name, last_name FROM employees WHERE abbreviation = ? COLLATE NOCASE',
        args: [abbr],
      });
      if (existing.rows.length > 0) {
        const match = existing.rows[0];
        if (match.is_active === 0) {
          return NextResponse.json(
            {
              error: 'inactive_duplicate',
              message: `An inactive employee with this abbreviation already exists: ${match.first_name} ${match.last_name}. Reactivate or permanently delete them first.`,
              existingEmployee: { id: match.id, first_name: match.first_name, last_name: match.last_name },
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: 'Abbreviation is already taken by an active employee' }, { status: 400 });
      }
      body.abbreviation = abbr;
    }

    // Check for inactive employees with the same email
    if (body.email) {
      const existingInactive = await db.execute({
        sql: 'SELECT id, first_name, last_name, email FROM employees WHERE email = ? AND is_active = 0',
        args: [body.email],
      });
      if (existingInactive.rows.length > 0) {
        const existing = existingInactive.rows[0];
        return NextResponse.json(
          {
            error: 'inactive_duplicate',
            message: `An inactive employee with this email already exists: ${existing.first_name} ${existing.last_name}`,
            existingEmployee: { id: existing.id, first_name: existing.first_name, last_name: existing.last_name, email: existing.email },
          },
          { status: 409 }
        );
      }
    }

    // Check for inactive employees with the same employee number
    if (body.employee_number) {
      const existingInactive = await db.execute({
        sql: 'SELECT id, first_name, last_name, employee_number FROM employees WHERE employee_number = ? AND is_active = 0',
        args: [body.employee_number],
      });
      if (existingInactive.rows.length > 0) {
        const existing = existingInactive.rows[0];
        return NextResponse.json(
          {
            error: 'inactive_duplicate',
            message: `An inactive employee with this employee number already exists: ${existing.first_name} ${existing.last_name}`,
            existingEmployee: { id: existing.id, first_name: existing.first_name, last_name: existing.last_name },
          },
          { status: 409 }
        );
      }
    }

    const newEmployee = await createEmployee({
      employee_number: body.employee_number,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      role: body.role || 'employee',
      group_id: body.group_id,
      date_of_hire: body.date_of_hire,
      rehire_date: body.rehire_date,
      employment_type: body.employment_type || 'full_time',
      seniority_rank: body.seniority_rank,
      abbreviation: body.abbreviation,
      show_in_office_presence: body.show_in_office_presence,
      created_by: authUser.id,
      is_active: 1
    });

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'CREATE',
      table_name: 'employees',
      record_id: newEmployee.id,
      new_values: JSON.stringify({
        employee_number: newEmployee.employee_number,
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email: newEmployee.email,
        role: newEmployee.role,
        group_id: newEmployee.group_id,
        date_of_hire: newEmployee.date_of_hire,
        rehire_date: newEmployee.rehire_date,
        employment_type: newEmployee.employment_type,
        seniority_rank: newEmployee.seniority_rank,
        abbreviation: newEmployee.abbreviation,
        show_in_office_presence: newEmployee.show_in_office_presence,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const employeeId = body.id;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get old employee for audit log
    const oldEmployee = await getEmployeeById(employeeId);
    if (!oldEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check permissions for the old group (Phase 2 CRUD permissions)
    // Allow self-service abbreviation update (user updating their own linked employee's abbreviation)
    const isSelfAbbreviationUpdate = authUser.employee_id === employeeId
      && body.abbreviation !== undefined
      && Object.keys(body).filter(k => k !== 'id' && k !== 'abbreviation').length === 0;

    const putIsSuperuser = await isSuperuser(authUser.id);
    const putHasFullAccess = putIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;

    if (!isSelfAbbreviationUpdate && !putHasFullAccess && oldEmployee.group_id) {
      const canUpdate = await canUserUpdateInGroup(authUser.id, oldEmployee.group_id);
      if (!canUpdate) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to edit this employee' },
          { status: 403 }
        );
      }
    }

    // Build update query
    const updates: string[] = [];
    const args: any[] = [];

    if (body.employee_number !== undefined) {
      // Normalize empty string to null (SQLite UNIQUE treats "" as duplicate but NULL as distinct)
      const normalizedNumber = body.employee_number || null;
      if (normalizedNumber) {
        const existing = await db.execute({
          sql: 'SELECT id, first_name, last_name, is_active FROM employees WHERE employee_number = ? AND id != ?',
          args: [normalizedNumber, employeeId],
        });
        if (existing.rows.length > 0) {
          const match = existing.rows[0];
          if (match.is_active === 0) {
            return NextResponse.json(
              { error: `Employee number already belongs to inactive employee: ${match.first_name} ${match.last_name}. Reactivate or permanently delete them first.` },
              { status: 409 }
            );
          }
          return NextResponse.json({ error: 'Employee number is already taken' }, { status: 400 });
        }
      }
      updates.push('employee_number = ?');
      args.push(normalizedNumber);
    }

    if (body.first_name !== undefined) {
      updates.push('first_name = ?');
      args.push(body.first_name);
    }

    if (body.last_name !== undefined) {
      updates.push('last_name = ?');
      args.push(body.last_name);
    }

    if (body.email !== undefined) {
      // Check for unique constraint collision with inactive employee
      if (body.email) {
        const existing = await db.execute({
          sql: 'SELECT id, first_name, last_name, is_active FROM employees WHERE email = ? AND id != ?',
          args: [body.email, employeeId],
        });
        if (existing.rows.length > 0) {
          const match = existing.rows[0];
          if (match.is_active === 0) {
            return NextResponse.json(
              { error: `Email already belongs to inactive employee: ${match.first_name} ${match.last_name}. Reactivate or permanently delete them first.` },
              { status: 409 }
            );
          }
          return NextResponse.json({ error: 'Email is already taken' }, { status: 400 });
        }
      }
      updates.push('email = ?');
      args.push(body.email || null);
    }

    if (body.role !== undefined) {
      updates.push('role = ?');
      args.push(body.role);
    }

    if (body.group_id !== undefined) {
      updates.push('group_id = ?');
      args.push(body.group_id);
    }

    if (body.date_of_hire !== undefined) {
      updates.push('date_of_hire = ?');
      args.push(body.date_of_hire);
    }

    if (body.rehire_date !== undefined) {
      updates.push('rehire_date = ?');
      args.push(body.rehire_date);
    }

    if (body.employment_type !== undefined) {
      updates.push('employment_type = ?');
      args.push(body.employment_type);
    }

    if (body.seniority_rank !== undefined) {
      updates.push('seniority_rank = ?');
      args.push(body.seniority_rank);
    }

    if (body.abbreviation !== undefined) {
      const abbr = body.abbreviation ? String(body.abbreviation).toUpperCase().trim() : null;
      if (abbr && abbr.length > 3) {
        return NextResponse.json({ error: 'Abbreviation must be 3 characters or less' }, { status: 400 });
      }
      if (abbr) {
        const existing = await db.execute({
          sql: 'SELECT id, first_name, last_name, is_active FROM employees WHERE abbreviation = ? COLLATE NOCASE AND id != ?',
          args: [abbr, employeeId],
        });
        if (existing.rows.length > 0) {
          const match = existing.rows[0];
          if (match.is_active === 0) {
            return NextResponse.json(
              { error: `Abbreviation already belongs to inactive employee: ${match.first_name} ${match.last_name}. Reactivate or permanently delete them first.` },
              { status: 409 }
            );
          }
          return NextResponse.json({ error: 'Abbreviation is already taken' }, { status: 400 });
        }
      }
      updates.push('abbreviation = ?');
      args.push(abbr);
    }

    if (body.show_in_office_presence !== undefined) {
      updates.push('show_in_office_presence = ?');
      args.push(body.show_in_office_presence);
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(body.is_active);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    args.push(employeeId);

    await db.execute({
      sql: `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    // Get updated employee
    const updatedEmployee = await getEmployeeById(employeeId);

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'UPDATE',
      table_name: 'employees',
      record_id: employeeId,
      old_values: JSON.stringify({
        employee_number: oldEmployee.employee_number,
        first_name: oldEmployee.first_name,
        last_name: oldEmployee.last_name,
        email: oldEmployee.email,
        role: oldEmployee.role,
        group_id: oldEmployee.group_id,
        date_of_hire: oldEmployee.date_of_hire,
        rehire_date: oldEmployee.rehire_date,
        employment_type: oldEmployee.employment_type,
        seniority_rank: oldEmployee.seniority_rank,
        abbreviation: oldEmployee.abbreviation,
        show_in_office_presence: oldEmployee.show_in_office_presence,
        is_active: oldEmployee.is_active,
      }),
      new_values: JSON.stringify({
        employee_number: updatedEmployee?.employee_number,
        first_name: updatedEmployee?.first_name,
        last_name: updatedEmployee?.last_name,
        email: updatedEmployee?.email,
        role: updatedEmployee?.role,
        group_id: updatedEmployee?.group_id,
        date_of_hire: updatedEmployee?.date_of_hire,
        rehire_date: updatedEmployee?.rehire_date,
        employment_type: updatedEmployee?.employment_type,
        seniority_rank: updatedEmployee?.seniority_rank,
        abbreviation: updatedEmployee?.abbreviation,
        show_in_office_presence: updatedEmployee?.show_in_office_presence,
        is_active: updatedEmployee?.is_active,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
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

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('id');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Get employee for audit log and permission check
    const employee = await getEmployeeById(parseInt(employeeId));
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check permissions using Phase 2 CRUD permissions
    const deleteIsSuperuser = await isSuperuser(authUser.id);
    const deleteHasFullAccess = deleteIsSuperuser
      || authUser.group?.is_master === 1
      || authUser.role?.can_access_all_groups === 1;

    if (!deleteHasFullAccess && employee.group_id) {
      const hasDeletePermission = await canUserDeleteInGroup(authUser.id, employee.group_id);
      if (!hasDeletePermission) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to delete this employee' },
          { status: 403 }
        );
      }
    }

    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Permanent delete: master admin only, employee must be inactive
      const userIsSuperuser = authUser.is_superuser === 1 || authUser.group?.is_master;
      if (!userIsSuperuser) {
        return NextResponse.json(
          { error: 'Forbidden: Only master admins can permanently delete employees' },
          { status: 403 }
        );
      }
      if (employee.is_active === 1) {
        return NextResponse.json(
          { error: 'Cannot permanently delete an active employee. Deactivate them first.' },
          { status: 400 }
        );
      }

      // Clear employee_id link on any auth user referencing this employee
      await clearEmployeeIdByEmployee(parseInt(employeeId));

      // Hard delete — CASCADE handles attendance_entries, employee_allocations, break_entries, office_presence
      await db.execute({
        sql: 'DELETE FROM employees WHERE id = ?',
        args: [employeeId],
      });

      // Log audit entry
      await logAudit({
        user_id: authUser.id,
        action: 'PERMANENT_DELETE',
        table_name: 'employees',
        record_id: parseInt(employeeId),
        old_values: JSON.stringify({
          employee_number: employee.employee_number,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          is_active: employee.is_active,
        }),
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });
    } else {
      // Soft delete: just deactivate
      await db.execute({
        sql: 'UPDATE employees SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [employeeId],
      });

      // Log audit entry
      await logAudit({
        user_id: authUser.id,
        action: 'DELETE',
        table_name: 'employees',
        record_id: parseInt(employeeId),
        old_values: JSON.stringify({
          employee_number: employee.employee_number,
          first_name: employee.first_name,
          last_name: employee.last_name,
          is_active: employee.is_active,
        }),
        new_values: JSON.stringify({
          is_active: 0,
        }),
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
