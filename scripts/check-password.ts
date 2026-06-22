import { db } from '../lib/db-sqlite';
import bcrypt from 'bcryptjs';

async function checkPassword() {
  try {
    const result = await db.execute('SELECT id, username, password_hash FROM users WHERE username = ?', ['admin']);

    if (result.rows.length === 0) {
      console.log('Admin user not found!');
      return;
    }

    const user = result.rows[0] as any;
    console.log('Admin user found:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Password hash:', user.password_hash);
    console.log('');

    // Test the password
    console.log('Testing password "admin123":');
    const isValid = await bcrypt.compare('admin123', user.password_hash);
    console.log('  Password valid:', isValid);

    if (!isValid) {
      console.log('');
      console.log('Password hash is invalid! Generating new hash...');
      const newHash = await bcrypt.hash('admin123', 10);
      console.log('  New hash:', newHash);
      console.log('');
      console.log('Updating database...');
      await db.execute('UPDATE users SET password_hash = ? WHERE id = 1', [newHash]);
      console.log('  ✓ Password updated successfully!');
      console.log('');
      console.log('Testing new password:');
      const isValid2 = await bcrypt.compare('admin123', newHash);
      console.log('  Password valid:', isValid2);
    }
  } catch (err) {
    console.error('Error:', err);
  }

  process.exit(0);
}

checkPassword();
