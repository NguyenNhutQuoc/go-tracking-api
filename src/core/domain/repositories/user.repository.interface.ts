// src/core/domain/repositories/user.repository.interface.ts
import { BaseRepositoryInterface } from './base.repository.interface';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import {
  Pagination,
  PaginatedResult,
} from '../value-objects/pagination.value-object';

export interface UserFilters {
  organizationId?: number;
  role?: UserRole;
  status?: UserStatus;
  isActive?: boolean;
  emailVerified?: boolean;
  search?: string; // Search in name, email, phone
}

export interface UserRepositoryInterface extends BaseRepositoryInterface<User> {
  // Authentication methods
  findByEmail(email: string): Promise<User | null>;
  findByEmailAndOrganization(
    email: string,
    organizationId: number,
  ): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  findByEmailVerificationToken(token: string): Promise<User | null>;

  // User management
  findByOrganization(organizationId: number): Promise<User[]>;
  findByOrganizationPaginated(
    organizationId: number,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>>;

  // Advanced filtering
  findWithFilters(
    filters: UserFilters,
    pagination?: Pagination,
  ): Promise<PaginatedResult<User>>;

  // Bulk operations
  findByIds(ids: number[]): Promise<User[]>;
  updateLastLogin(userId: number): Promise<void>;
  incrementLoginAttempts(userId: number): Promise<void>;
  resetLoginAttempts(userId: number): Promise<void>;

  // Statistics
  countByOrganization(organizationId: number): Promise<number>;
  countByRole(organizationId: number, role: UserRole): Promise<number>;
  countActiveUsers(organizationId: number): Promise<number>;

  // Soft delete
  softDelete(id: number): Promise<boolean>;
  restore(id: number): Promise<boolean>;
}
