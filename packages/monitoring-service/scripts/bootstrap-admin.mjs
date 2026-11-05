import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { ulid } from 'ulid';

const email = process.env.INITIAL_HRD_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_HRD_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error(
    'Set INITIAL_HRD_ADMIN_EMAIL and INITIAL_HRD_ADMIN_PASSWORD in the environment before bootstrapping.',
  );
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('INITIAL_HRD_ADMIN_EMAIL must be a valid email address.');
}

if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
  throw new Error(
    'INITIAL_HRD_ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.',
  );
}

const requiredDatabaseVariables = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingDatabaseVariables = requiredDatabaseVariables.filter(
  (variable) => !process.env[variable],
);

if (missingDatabaseVariables.length > 0) {
  throw new Error(`Missing database configuration: ${missingDatabaseVariables.join(', ')}.`);
}

await import('./migrate.mjs');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  timezone: 'Z',
});

try {
  const [existingUsers] = await connection.execute(
    'SELECT role FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [email],
  );

  if (existingUsers.length > 0) {
    if (existingUsers[0].role !== 'HRD_ADMIN') {
      throw new Error('An active non-admin account already uses the configured admin email.');
    }

    console.log(`An active HRD admin already exists for ${email}; no changes were made.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    await connection.execute(
      `INSERT INTO users
        (id, employee_id, email, password_hash, role, is_active, must_change_password)
       VALUES (?, NULL, ?, ?, 'HRD_ADMIN', 1, 1)`,
      [ulid(), email, passwordHash],
    );

    console.log(`Created initial HRD admin for ${email}. Change the password after first login.`);
  }
} finally {
  await connection.end();
}
