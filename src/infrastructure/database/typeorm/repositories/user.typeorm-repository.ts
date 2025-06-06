import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseTypeormRepository } from './base.typeorm-repository';
import { UserTypeormEntity } from '../entities/user.typeorm-entity';
import {
  User,
  UserRole,
  UserStatus,
} from '../../../../core/domain/entities/user.entity';
import {
  UserRepositoryInterface,
  UserFilters,
} from '../../../../core/domain/repositories/user.repository.interface';
import {
  Pagination,
  PaginatedResult,
} from '../../../../core/domain/value-objects/pagination.value-object';

@Injectable()
export class UserTypeormRepository
  extends BaseTypeormRepository<UserTypeormEntity, User>
  implements UserRepositoryInterface
{
  constructor(
    @InjectRepository(UserTypeormEntity)
    private readonly userRepository: Repository<UserTypeormEntity>,
  ) {
    super(
      userRepository,
      UserTypeormRepository.toEntity,
      UserTypeormRepository.toTypeorm,
    );
  }

  // Mappers
  static toEntity(this: void, typeormEntity: UserTypeormEntity): User {
    return new User({
      id: typeormEntity.id,
      createdAt: typeormEntity.createdAt,
      updatedAt: typeormEntity.updatedAt,
      organizationId: typeormEntity.organizationId,
      phone: typeormEntity.phone,
      passwordHash: typeormEntity.passwordHash,
      fullName: typeormEntity.fullName,
      email: typeormEntity.email,
      role: typeormEntity.role as UserRole,
      status: typeormEntity.status as UserStatus,
      isActive: typeormEntity.isActive,
      phoneVerified: typeormEntity.phoneVerified,
      emailVerified: typeormEntity.emailVerified,
      lastLogin: typeormEntity.lastLogin,
      loginAttempts: typeormEntity.loginAttempts,
      lockedUntil: typeormEntity.lockedUntil,
    });
  }

  static toTypeorm(this: void, entity: Partial<User>): UserTypeormEntity {
    const typeormEntity = new UserTypeormEntity();
    if (entity.id) typeormEntity.id = entity.id;
    if (entity.organizationId)
      typeormEntity.organizationId = entity.organizationId;
    if (entity.phone) typeormEntity.phone = entity.phone;
    if (entity.passwordHash) typeormEntity.passwordHash = entity.passwordHash;
    if (entity.fullName) typeormEntity.fullName = entity.fullName;
    if (entity.email) typeormEntity.email = entity.email;
    if (entity.role) typeormEntity.role = entity.role;
    if (entity.status) typeormEntity.status = entity.status;
    if (entity.isActive !== undefined) typeormEntity.isActive = entity.isActive;
    if (entity.phoneVerified !== undefined)
      typeormEntity.phoneVerified = entity.phoneVerified;
    if (entity.emailVerified !== undefined)
      typeormEntity.emailVerified = entity.emailVerified;
    if (entity.lastLogin) typeormEntity.lastLogin = entity.lastLogin;
    if (entity.loginAttempts !== undefined)
      typeormEntity.loginAttempts = entity.loginAttempts;
    if (entity.lockedUntil) typeormEntity.lockedUntil = entity.lockedUntil;
    return typeormEntity;
  }

  // Phone-based methods
  async findByPhone(phone: string): Promise<User | null> {
    const typeormEntity = await this.userRepository.findOne({
      where: { phone },
    });
    return typeormEntity ? UserTypeormRepository.toEntity(typeormEntity) : null;
  }

  async findByPhoneAndOrganization(
    phone: string,
    organizationId: number,
  ): Promise<User | null> {
    const typeormEntity = await this.userRepository.findOne({
      where: { phone, organizationId },
    });
    return typeormEntity ? UserTypeormRepository.toEntity(typeormEntity) : null;
  }

  // Management methods
  async findByOrganization(organizationId: number): Promise<User[]> {
    const typeormEntities = await this.userRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return typeormEntities.map(UserTypeormRepository.toEntity);
  }

  async findByOrganizationPaginated(
    organizationId: number,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>> {
    const [typeormEntities, totalItems] =
      await this.userRepository.findAndCount({
        where: { organizationId },
        skip: pagination.skip,
        take: pagination.limit,
        order: { createdAt: 'DESC' },
      });

    const items = typeormEntities.map(UserTypeormRepository.toEntity);
    return PaginatedResult.create(items, pagination, totalItems);
  }

  async findWithFilters(
    filters: UserFilters,
    pagination?: Pagination,
  ): Promise<PaginatedResult<User>> {
    const queryBuilder = this.buildFilterQuery(filters);

    if (pagination) {
      queryBuilder.skip(pagination.skip).take(pagination.limit);
    }

    const [typeormEntities, totalItems] = await queryBuilder.getManyAndCount();
    const items = typeormEntities.map(UserTypeormRepository.toEntity);

    const paginationToUse = pagination || new Pagination(1, totalItems);
    return PaginatedResult.create(items, paginationToUse, totalItems);
  }

  private buildFilterQuery(
    filters: UserFilters,
  ): SelectQueryBuilder<UserTypeormEntity> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (filters.organizationId) {
      queryBuilder.andWhere('user.organizationId = :organizationId', {
        organizationId: filters.organizationId,
      });
    }

    if (filters.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', {
        status: filters.status,
      });
    }

    if (filters.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    if (filters.phoneVerified !== undefined) {
      queryBuilder.andWhere('user.phoneVerified = :phoneVerified', {
        phoneVerified: filters.phoneVerified,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return queryBuilder.orderBy('user.createdAt', 'DESC');
  }

  // Bulk operations
  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const typeormEntities = await this.userRepository.findByIds(ids);
    return typeormEntities.map(UserTypeormRepository.toEntity);
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      lastLogin: new Date(),
      loginAttempts: 0,
      lockedUntil: undefined,
    });
  }

  async incrementLoginAttempts(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const loginAttempts = (user.loginAttempts || 0) + 1;
    const updateData: Partial<UserTypeormEntity> = { loginAttempts };

    if (loginAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }

    await this.userRepository.update(userId, updateData);
  }

  async resetLoginAttempts(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      loginAttempts: 0,
      lockedUntil: undefined,
    });
  }

  // Statistics
  async countByOrganization(organizationId: number): Promise<number> {
    return this.userRepository.count({ where: { organizationId } });
  }

  async countByRole(organizationId: number, role: UserRole): Promise<number> {
    return this.userRepository.count({ where: { organizationId, role } });
  }

  async countActiveUsers(organizationId: number): Promise<number> {
    return this.userRepository.count({
      where: {
        organizationId,
        isActive: true,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // Soft delete
  async softDelete(id: number): Promise<boolean> {
    const result = await this.userRepository.update(id, { isActive: false });
    return result.affected ? result.affected > 0 : false;
  }

  async restore(id: number): Promise<boolean> {
    const result = await this.userRepository.update(id, { isActive: true });
    return result.affected ? result.affected > 0 : false;
  }
}
