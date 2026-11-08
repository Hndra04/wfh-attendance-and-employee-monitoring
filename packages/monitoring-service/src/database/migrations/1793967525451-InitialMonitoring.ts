import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMonitoring1793967525451 implements MigrationInterface {
    name = 'InitialMonitoring1793967525451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`employees\` (\`id\` char(26) NOT NULL, \`full_name\` varchar(150) NOT NULL, \`email\` varchar(150) NOT NULL, \`active_email\` varchar(150) AS (CASE WHEN deleted_at IS NULL THEN email ELSE NULL END) STORED NULL, \`department\` varchar(100) NOT NULL, \`position\` varchar(100) NOT NULL, \`join_date\` date NOT NULL, \`phone\` varchar(30) NULL, \`address\` text NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, INDEX \`idx_employees_full_name\` (\`full_name\`), INDEX \`idx_employees_department_status\` (\`department\`, \`status\`), UNIQUE INDEX \`uq_employees_active_email\` (\`active_email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`, [queryRunner.connection.options.database,"employees","GENERATED_COLUMN","active_email","CASE WHEN deleted_at IS NULL THEN email ELSE NULL END"]);
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` char(26) NOT NULL, \`email\` varchar(150) NOT NULL, \`active_email\` varchar(150) AS (CASE WHEN deleted_at IS NULL THEN email ELSE NULL END) STORED NULL, \`password_hash\` varchar(255) NOT NULL, \`role\` enum ('EMPLOYEE', 'HRD_ADMIN') NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`must_change_password\` tinyint NOT NULL DEFAULT 0, \`last_login_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, \`employee_id\` char(26) NULL, UNIQUE INDEX \`uq_users_active_email\` (\`active_email\`), INDEX \`idx_users_email\` (\`email\`), UNIQUE INDEX \`REL_9760615d88ed518196bb79ea03\` (\`employee_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`, [queryRunner.connection.options.database,"users","GENERATED_COLUMN","active_email","CASE WHEN deleted_at IS NULL THEN email ELSE NULL END"]);
        await queryRunner.query(`CREATE TABLE \`refresh_tokens_monitoring\` (\`id\` char(26) NOT NULL, \`user_id\` char(26) NOT NULL, \`token_hash\` varchar(255) NOT NULL, \`family_id\` char(26) NOT NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_refresh_tokens_monitoring_user_family\` (\`user_id\`, \`family_id\`), UNIQUE INDEX \`uq_refresh_tokens_monitoring_hash\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_9760615d88ed518196bb79ea03d\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens_monitoring\` ADD CONSTRAINT \`FK_2abede80ed56576dd72c54bfeb4\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_tokens_monitoring\` DROP FOREIGN KEY \`FK_2abede80ed56576dd72c54bfeb4\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_9760615d88ed518196bb79ea03d\``);
        await queryRunner.query(`DROP INDEX \`uq_refresh_tokens_monitoring_hash\` ON \`refresh_tokens_monitoring\``);
        await queryRunner.query(`DROP INDEX \`idx_refresh_tokens_monitoring_user_family\` ON \`refresh_tokens_monitoring\``);
        await queryRunner.query(`DROP TABLE \`refresh_tokens_monitoring\``);
        await queryRunner.query(`DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`, ["GENERATED_COLUMN","active_email",queryRunner.connection.options.database,"users"]);
        await queryRunner.query(`DROP INDEX \`REL_9760615d88ed518196bb79ea03\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`idx_users_email\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`uq_users_active_email\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
        await queryRunner.query(`DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`, ["GENERATED_COLUMN","active_email",queryRunner.connection.options.database,"employees"]);
        await queryRunner.query(`DROP INDEX \`uq_employees_active_email\` ON \`employees\``);
        await queryRunner.query(`DROP INDEX \`idx_employees_department_status\` ON \`employees\``);
        await queryRunner.query(`DROP INDEX \`idx_employees_full_name\` ON \`employees\``);
        await queryRunner.query(`DROP TABLE \`employees\``);
    }

}
