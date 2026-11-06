import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from './user.entity';

@Entity('refresh_tokens_monitoring')
@Index('uq_refresh_tokens_monitoring_hash', ['tokenHash'], { unique: true })
@Index('idx_refresh_tokens_monitoring_user_family', ['userId', 'familyId'])
export class RefreshToken {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'user_id', type: 'char', length: 26 })
  userId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'family_id', type: 'char', length: 26 })
  familyId!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
