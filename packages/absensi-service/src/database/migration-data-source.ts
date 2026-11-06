import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { Employee } from './entities/employee.entity';
import { Attendance } from './entities/attendance.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

const requiredVariables = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVariables = requiredVariables.filter((variable) => !process.env[variable]);

if (missingVariables.length > 0) {
  throw new Error(`Missing database configuration: ${missingVariables.join(', ')}.`);
}

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  entities: [Attendance, Employee, RefreshToken, User],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
