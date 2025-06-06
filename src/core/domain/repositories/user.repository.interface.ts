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
  phoneVerified?: boolean;
  search?: string;
}

export interface UserRepositoryInterface extends BaseRepositoryInterface<User> {
  // Phone-based authentication
  findByPhone(phone: string): Promise<User | null>;
  findByPhoneAndOrganization(
    phone: string,
    organizationId: number,
  ): Promise<User | null>;

  // Management
  findByOrganization(organizationId: number): Promise<User[]>;
  findByOrganizationPaginated(
    organizationId: number,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>>;
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
