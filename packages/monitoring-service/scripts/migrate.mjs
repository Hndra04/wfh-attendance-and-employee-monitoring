import { DataSource } from 'typeorm';

class CreateUsersTable1793836800000 {
  name = 'CreateUsersTable1793836800000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE users (
        id CHAR(26) NOT NULL,
        employee_id CHAR(26) NULL,
        email VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('EMPLOYEE', 'HRD_ADMIN') NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        active_email VARCHAR(150) GENERATED ALWAYS AS (
          CASE WHEN deleted_at IS NULL THEN email ELSE NULL END
        ) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_email_deleted_at (email, deleted_at),
        UNIQUE KEY uq_users_active_email (active_email),
        KEY idx_users_email (email)
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE users');
  }
}

const requiredVariables = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVariables = requiredVariables.filter((variable) => !process.env[variable]);

if (missingVariables.length > 0) {
  throw new Error(`Missing database configuration: ${missingVariables.join(', ')}.`);
}

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
  migrations: [CreateUsersTable1793836800000],
});

await dataSource.initialize();

try {
  await dataSource.runMigrations();
  console.log('Database migrations are up to date.');
} finally {
  await dataSource.destroy();
}
