import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialAttendance1793967617382 implements MigrationInterface {
    name = 'InitialAttendance1793967617382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`attendances\` (\`id\` char(26) NOT NULL, \`employee_id\` char(26) NOT NULL, \`attendance_date\` date NOT NULL, \`check_in_at\` datetime NULL, \`check_out_at\` datetime NULL, \`check_in_photo_path\` varchar(255) NOT NULL, \`check_out_photo_path\` varchar(255) NULL, \`notes\` varchar(500) NULL, \`status\` enum ('PRESENT', 'LATE') NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_attendances_date\` (\`attendance_date\`), UNIQUE INDEX \`uq_attendances_employee_date\` (\`employee_id\`, \`attendance_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`refresh_tokens_absensi\` (\`id\` char(26) NOT NULL, \`user_id\` char(26) NOT NULL, \`token_hash\` varchar(255) NOT NULL, \`family_id\` char(26) NOT NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_refresh_tokens_absensi_user_family\` (\`user_id\`, \`family_id\`), UNIQUE INDEX \`uq_refresh_tokens_absensi_hash\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`attendances\` ADD CONSTRAINT \`FK_43dca8b4751d7449a38b583991c\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens_absensi\` ADD CONSTRAINT \`FK_1ecf233cbf5bd879ea1a9d128b2\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_tokens_absensi\` DROP FOREIGN KEY \`FK_1ecf233cbf5bd879ea1a9d128b2\``);
        await queryRunner.query(`ALTER TABLE \`attendances\` DROP FOREIGN KEY \`FK_43dca8b4751d7449a38b583991c\``);
        await queryRunner.query(`DROP INDEX \`uq_refresh_tokens_absensi_hash\` ON \`refresh_tokens_absensi\``);
        await queryRunner.query(`DROP INDEX \`idx_refresh_tokens_absensi_user_family\` ON \`refresh_tokens_absensi\``);
        await queryRunner.query(`DROP TABLE \`refresh_tokens_absensi\``);
        await queryRunner.query(`DROP INDEX \`uq_attendances_employee_date\` ON \`attendances\``);
        await queryRunner.query(`DROP INDEX \`idx_attendances_date\` ON \`attendances\``);
        await queryRunner.query(`DROP TABLE \`attendances\``);
    }

}
