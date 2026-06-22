import { Client } from '@libsql/client';
import { tableExists } from '../index';

export const migration = {
  name: 'seed_job_titles',
  description: 'Seed default job titles into the job_titles table',
  up: async (db: Client) => {
    console.log('Running migration: seed_job_titles');

    // Ensure job_titles table exists (it should be created in db-auth.ts init)
    const jobTitlesExists = await tableExists(db, 'job_titles');
    if (!jobTitlesExists) {
      // Create the table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS job_titles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✓ job_titles table created');
    }

    // Insert default job titles
    const defaultJobTitles = [
      { name: 'Employee', description: 'General employee' },
      { name: 'Supervisor', description: 'Team supervisor' },
      { name: 'Manager', description: 'Department manager' },
      { name: 'Director', description: 'Division director' },
      { name: 'Administrator', description: 'System administrator' },
      { name: 'HR Specialist', description: 'Human resources specialist' },
      { name: 'Accountant', description: 'Financial accountant' },
      { name: 'Technician', description: 'Technical specialist' },
      { name: 'Engineer', description: 'Engineering professional' },
      { name: 'Analyst', description: 'Business or data analyst' },
      { name: 'Coordinator', description: 'Project or team coordinator' },
      { name: 'Assistant', description: 'Administrative assistant' },
      { name: 'Consultant', description: 'External consultant' },
      { name: 'Specialist', description: 'Subject matter specialist' },
      { name: 'Contractor', description: 'Contract worker' },
      { name: 'Intern', description: 'Internship position' },
      { name: 'Other', description: 'Other job title' },
    ];

    let insertedCount = 0;
    for (const jobTitle of defaultJobTitles) {
      try {
        await db.execute({
          sql: `INSERT OR IGNORE INTO job_titles (name, description) VALUES (?, ?)`,
          args: [jobTitle.name, jobTitle.description],
        });
        insertedCount++;
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log(`  ✓ Seeded ${insertedCount} default job titles`);
    console.log('✓ Job titles migration completed successfully');
  },
  down: async (db: Client) => {
    // We don't want to delete job titles on rollback as they may have been modified
    console.log('Rollback: Job titles will not be deleted to preserve user customizations');
  },
};
