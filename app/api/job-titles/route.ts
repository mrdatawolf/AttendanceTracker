import { NextRequest, NextResponse } from 'next/server';
import {
  getAllJobTitles,
  getActiveJobTitles,
  getJobTitleById,
  createJobTitle,
  updateJobTitle,
  deleteJobTitle,
  logAudit,
} from '@/lib/queries-auth';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';

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
    const jobTitleId = searchParams.get('id');
    const activeOnly = searchParams.get('active') === 'true';

    if (jobTitleId) {
      const jobTitle = await getJobTitleById(parseInt(jobTitleId));
      if (jobTitle) {
        return NextResponse.json(jobTitle);
      } else {
        return NextResponse.json({ error: 'Job title not found' }, { status: 404 });
      }
    } else {
      const jobTitles = activeOnly ? await getActiveJobTitles() : await getAllJobTitles();
      return NextResponse.json(jobTitles);
    }
  } catch (error) {
    console.error('Error fetching job titles:', error);
    return NextResponse.json({ error: 'Failed to fetch job titles' }, { status: 500 });
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

    // Only superusers or master group can create job titles
    if (!authUser.is_superuser && !authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create job titles' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'Job title name is required' },
        { status: 400 }
      );
    }

    const newJobTitle = await createJobTitle({
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      is_active: body.is_active ?? 1,
    });

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'CREATE',
      table_name: 'job_titles',
      record_id: newJobTitle.id,
      new_values: JSON.stringify({
        name: newJobTitle.name,
        description: newJobTitle.description,
        is_active: newJobTitle.is_active,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(newJobTitle);
  } catch (error: any) {
    console.error('Error creating job title:', error);
    // Handle unique constraint violation
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A job title with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to create job title' }, { status: 500 });
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

    // Only superusers or master group can edit job titles
    if (!authUser.is_superuser && !authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can edit job titles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const jobTitleId = body.id;

    if (!jobTitleId) {
      return NextResponse.json(
        { error: 'Job title ID is required' },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const oldJobTitle = await getJobTitleById(jobTitleId);
    if (!oldJobTitle) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 });
    }

    // Build updates object
    const updates: any = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { error: 'Job title name cannot be empty' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }
    if (body.is_active !== undefined) {
      updates.is_active = body.is_active ? 1 : 0;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedJobTitle = await updateJobTitle(jobTitleId, updates);

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'UPDATE',
      table_name: 'job_titles',
      record_id: jobTitleId,
      old_values: JSON.stringify({
        name: oldJobTitle.name,
        description: oldJobTitle.description,
        is_active: oldJobTitle.is_active,
      }),
      new_values: JSON.stringify({
        name: updatedJobTitle?.name,
        description: updatedJobTitle?.description,
        is_active: updatedJobTitle?.is_active,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(updatedJobTitle);
  } catch (error: any) {
    console.error('Error updating job title:', error);
    // Handle unique constraint violation
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A job title with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to update job title' }, { status: 500 });
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

    // Only superusers or master group can delete job titles
    if (!authUser.is_superuser && !authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can delete job titles' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobTitleId = searchParams.get('id');

    if (!jobTitleId) {
      return NextResponse.json(
        { error: 'Job title ID is required' },
        { status: 400 }
      );
    }

    const id = parseInt(jobTitleId);

    // Get job title for audit log
    const jobTitle = await getJobTitleById(id);
    if (!jobTitle) {
      return NextResponse.json({ error: 'Job title not found' }, { status: 404 });
    }

    // Check if job title is assigned to any employees
    // Note: This will be implemented when job_title_id is added to employees table
    // For now, we'll allow deletion

    // Delete the job title
    await deleteJobTitle(id);

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'DELETE',
      table_name: 'job_titles',
      record_id: id,
      old_values: JSON.stringify({
        name: jobTitle.name,
        description: jobTitle.description,
        is_active: jobTitle.is_active,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, message: 'Job title deleted successfully' });
  } catch (error) {
    console.error('Error deleting job title:', error);
    return NextResponse.json({ error: 'Failed to delete job title' }, { status: 500 });
  }
}
