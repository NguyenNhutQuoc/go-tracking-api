// src/core/domain/entities/user.entity.ts
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
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

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
      this.emailVerified
    );
  }

  incrementLoginAttempts(): void {
    this.loginAttempts += 1;

    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockedUntil = undefined;
    this.lastLogin = new Date();
  }

  generateResetToken(): string {
    const token =
      Math.random().toString(36).substr(2, 15) +
      Math.random().toString(36).substr(2, 15);
    this.resetPasswordToken = token;
    this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return token;
  }

  generateEmailVerificationToken(): string {
    const token =
      Math.random().toString(36).substr(2, 15) +
      Math.random().toString(36).substr(2, 15);
    this.emailVerificationToken = token;
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
  }

  verifyEmail(): void {
    this.emailVerified = true;
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
  }

  verifyPhone(): void {
    this.phoneVerified = true;
  }
}
