// ========================================
// 3. UPDATE USER ENTITY
// ========================================
// File: src/core/domain/entities/user.entity.ts

import { BaseEntity } from './base.entity';

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

export class User extends BaseEntity {
  organizationId: number;
  phone: string; // Primary identifier (was email)
  passwordHash: string;
  fullName: string;
  email?: string; // Optional now
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  phoneVerified: boolean; // Primary verification
  emailVerified: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockedUntil?: Date;

  constructor(partial: Partial<User>) {
    super(partial);
    Object.assign(this, partial);
  }

  isLocked(): boolean {
    return this.lockedUntil ? this.lockedUntil > new Date() : false;
  }

  canLogin(): boolean {
    return (
      this.isActive &&
      this.status === UserStatus.ACTIVE &&
      !this.isLocked() &&
      this.phoneVerified // Phone must be verified
    );
  }

  incrementLoginAttempts(): void {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockedUntil = undefined;
    this.lastLogin = new Date();
  }

  verifyPhone(): void {
    this.phoneVerified = true;
    if (this.status === UserStatus.PENDING) {
      this.status = UserStatus.ACTIVE;
    }
  }
}
