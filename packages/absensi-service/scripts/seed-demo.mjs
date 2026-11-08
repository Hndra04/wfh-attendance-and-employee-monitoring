import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { ulid } from 'ulid';

const employees = JSON.parse(
  await readFile(new URL('../../../seed/demo-employees.json', import.meta.url), 'utf8'),
);
const todayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date());
const today = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
const attendanceDate = `${today.year}-${today.month}-${today.day}`;
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

  for (const [index, employee] of employees.entries()) {
    const [existingAttendance] = await connection.execute(
      'SELECT id FROM attendances WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
      [employee.id, attendanceDate],
    );

    if (existingAttendance.length > 0) {
      continue;
    }

    const checkInHour = index === 0 ? 1 : 2;
    const checkInMinute = index === 0 ? 55 : 15;
    const checkInAt = new Date(
      Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), checkInHour, checkInMinute),
    );
    const checkOutAt = new Date(
      Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), 10, 0),
    );

    await connection.execute(
      `INSERT INTO attendances
        (id, employee_id, attendance_date, check_in_at, check_out_at,
         check_in_photo_path, check_out_photo_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ulid(),
        employee.id,
        attendanceDate,
        checkInAt,
        checkOutAt,
        `seed/${employee.id}/check-in.jpg`,
        `seed/${employee.id}/check-out.jpg`,
        index === 0 ? 'PRESENT' : 'LATE',
      ],
    );
  }

  await connection.commit();
  console.log(`Demo attendance is up to date for ${attendanceDate}.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
