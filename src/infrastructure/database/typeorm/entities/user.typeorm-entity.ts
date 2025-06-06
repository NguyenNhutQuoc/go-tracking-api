// ========================================
// 4. UPDATE TYPEORM ENTITY
// ========================================
// File: src/infrastructure/database/typeorm/entities/user.typeorm-entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseTypeormEntity } from './base.typeorm-entity';
import { OrganizationTypeormEntity } from './organization.typeorm-entity';

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  VISITOR = 'visitor',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

@Entity('users')
@Index(['phone'], { unique: true })
@Index(['organizationId'])
@Index(['phone', 'organizationId'])
export class UserTypeormEntity extends BaseTypeormEntity {
  @Column({ name: 'organization_id' })
  organizationId: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.VISITOR,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ name: 'login_attempts', type: 'int', default: 0 })
  loginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  @ManyToOne(() => OrganizationTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationTypeormEntity;
}
