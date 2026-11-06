import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { ulid } from 'ulid';

const password = process.env.DEMO_EMPLOYEE_PASSWORD;

if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
  throw new Error('Set DEMO_EMPLOYEE_PASSWORD to a password of 12–72 UTF-8 bytes.');
}

const employees = JSON.parse(
  await readFile(new URL('../../../seed/demo-employees.json', import.meta.url), 'utf8'),
);
const passwordHash = await bcrypt.hash(password, 12);
const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  timezone: 'Z',
});

try {
  await connection.beginTransaction();

  for (const employee of employees) {
    const [existingById] = await connection.execute(
      'SELECT id, deleted_at FROM employees WHERE id = ? LIMIT 1',
      [employee.id],
    );
    const [existingByEmail] = await connection.execute(
      'SELECT id FROM employees WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [employee.email],
    );

    if (existingByEmail.length > 0 && existingByEmail[0].id !== employee.id) {
      throw new Error(`Demo employee email is already assigned to another employee: ${employee.email}`);
    }

    if (existingById.length > 0 && existingById[0].deleted_at !== null) {
      throw new Error(`Demo employee was soft-deleted; refusing to reactivate it: ${employee.email}`);
    }

    if (existingById.length === 0) {
      await connection.execute(
        `INSERT INTO employees
          (id, full_name, email, department, position, join_date, phone, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          employee.id,
          employee.fullName,
          employee.email,
          employee.department,
          employee.position,
          employee.joinDate,
          employee.phone,
          employee.address,
        ],
      );
    }

    const [existingUsers] = await connection.execute(
      'SELECT id, email, role FROM users WHERE employee_id = ? AND deleted_at IS NULL LIMIT 1',
      [employee.id],
    );

    if (existingUsers.length > 0) {
      if (existingUsers[0].email !== employee.email || existingUsers[0].role !== 'EMPLOYEE') {
        throw new Error(`Demo employee account is linked to unexpected user data: ${employee.email}`);
      }
      continue;
    }

    const [userWithEmail] = await connection.execute(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [employee.email],
    );

    if (userWithEmail.length > 0) {
      throw new Error(`Demo employee email is already used by another account: ${employee.email}`);
    }

    await connection.execute(
      `INSERT INTO users
        (id, employee_id, email, password_hash, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 'EMPLOYEE', 1, 1)`,
      [ulid(), employee.id, employee.email, passwordHash],
    );
  }

  await connection.commit();
  console.log(`Demo employee records are up to date (${employees.length} employees).`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
