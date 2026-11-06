import mysql from 'mysql2/promise';
import { ulid } from 'ulid';

if (process.env.PERFORMANCE_SEED_CONFIRM !== 'YES') {
  throw new Error('Set PERFORMANCE_SEED_CONFIRM=YES to seed performance data.');
}

if (!/_perf(?:ormance)?$/i.test(process.env.DB_NAME ?? '')) {
  throw new Error('Performance data is restricted to a database ending in _perf or _performance.');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  timezone: 'Z',
});

const employeeIds = Array.from({ length: 10 }, () => ulid());

try {
  const [existingAttendance] = await connection.execute('SELECT COUNT(*) AS count FROM attendances');

  if (Number(existingAttendance[0].count) > 0) {
    throw new Error('The performance database must have an empty attendances table.');
  }

  await connection.beginTransaction();
  const rows = Array.from({ length: 50 }, (_, index) => {
    const employeeId = employeeIds[index % employeeIds.length];
    const date = new Date(
      Date.UTC(2026, 10, 5 - Math.floor(index / employeeIds.length)),
    );
    const attendanceDate = date.toISOString().slice(0, 10);
    const checkInAt = new Date(`${attendanceDate}T02:00:00.000Z`);
    const checkOutAt = new Date(`${attendanceDate}T10:00:00.000Z`);

    return [
      ulid(),
      employeeId,
      attendanceDate,
      checkInAt,
      checkOutAt,
      `seed/performance/${index}-in.jpg`,
      `seed/performance/${index}-out.jpg`,
      index % 4 === 0 ? 'LATE' : 'PRESENT',
      new Date(),
      new Date(),
    ];
  });

  for (let offset = 0; offset < rows.length; offset += 250) {
    await connection.query(
      `INSERT INTO attendances
        (id, employee_id, attendance_date, check_in_at, check_out_at,
         check_in_photo_path, check_out_photo_path, status, created_at, updated_at)
       VALUES ?`,
      [rows.slice(offset, offset + 250)],
    );
  }

  await connection.commit();
  console.log('Seeded 50 sample attendance rows for 10 employee IDs.');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
