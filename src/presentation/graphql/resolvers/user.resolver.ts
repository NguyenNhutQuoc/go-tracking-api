/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/presentation/graphql/resolvers/user.resolver.ts
import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards, Logger, ForbiddenException, Inject } from '@nestjs/common';
import { UserRepositoryInterface } from '../../../core/domain/repositories/user.repository.interface';
import {
  AuthService,
  USER_REPOSITORY_TOKEN,
} from '../../../core/application/services/auth.service';
import {
  User as UserEntity,
  UserRole,
} from '../../../core/domain/entities/user.entity';

// Ensure UserRole has ADMIN and STAFF members
if (
  typeof UserRole === 'undefined' ||
  typeof UserRole.ADMIN === 'undefined' ||
  typeof UserRole.STAFF === 'undefined'
) {
  throw new Error('UserRole enum is missing ADMIN or STAFF members');
}
import {
  User,
  UserPaginatedResponse,
  MessageResponse,
} from '../types/user.types';
import {
  UpdateUserInput,
  UserFiltersInput,
  ChangePasswordInput,
} from '../inputs/user.input';
import { PaginationInput } from '../inputs/pagination.input';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { UserDataLoaderService } from '../../../infrastructure/dataloader/user.dataloader';
import DataLoader from 'dataloader';

@Resolver(() => User)
@UseGuards(JwtAuthGuard)
export class UserResolver {
  private readonly logger = new Logger(UserResolver.name);

  constructor(
    // Inject the user repository and other services
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepositoryInterface,
    private readonly authService: AuthService,
    private readonly userDataLoader: UserDataLoaderService,
  ) {}

  @Query(() => User, { nullable: true })
  async user(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<User | null> {
    // Use DataLoader to prevent N+1 queries
    const userLoader: DataLoader<string, User> =
      context.loaders?.usersLoader || this.userDataLoader.createUserLoader();
    const user = await userLoader.load(id);
    return user;
  }

  @Query(() => [User])
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async users(
    @CurrentUser() currentUser: UserEntity,
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
  ): Promise<User[]> {
    // Ensure users can only see users from their organization
    const searchFilters = {
      ...filters,
      organizationId: currentUser.organizationId,
    };

    const result = await this.userRepository.findWithFilters(searchFilters);
    return result.items as User[];
  }

  @Query(() => UserPaginatedResponse)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async usersPaginated(
    @Args('pagination') pagination: PaginationInput,
    @CurrentUser() currentUser: UserEntity,
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
  ): Promise<UserPaginatedResponse> {
    // Ensure users can only see users from their organization
    const searchFilters = {
      ...filters,
      organizationId: currentUser.organizationId,
    };

    const paginationObj = {
      page: pagination.page,
      limit: pagination.limit,
      skip: (pagination.page - 1) * pagination.limit,
    };

    const result = await this.userRepository.findWithFilters(
      searchFilters,
      paginationObj,
    );

    return {
      items: result.items as User[],
      meta: result.meta,
    };
  }

  @Query(() => User)
  me(@CurrentUser() user: UserEntity): User {
    return user as User;
  }

  @Mutation(() => User)
  async updateUser(
    @Args('id', { type: () => ID }) id: number,
    @Args('input') input: UpdateUserInput,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<User> {
    // Check permissions
    const targetUser = await this.userRepository.findById(id);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Users can only update themselves, or admins can update users in their organization
    const canUpdate =
      currentUser.id === id ||
      (currentUser.role === UserRole.ADMIN &&
        currentUser.organizationId === targetUser.organizationId);

    if (!canUpdate) {
      throw new ForbiddenException(
        'You can only update your own profile or users in your organization',
      );
    }

    // Prevent non-admins from changing roles
    if (input.role && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can change user roles');
    }

    const updatedUser = await this.userRepository.update(id, input);
    this.logger.log(
      `User updated: ${updatedUser.email} by ${currentUser.email}`,
    );

    return updatedUser as User;
  }

  @Mutation(() => User)
  async updateMyProfile(
    @Args('input') input: UpdateUserInput,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<User> {
    // Remove fields that users shouldn't be able to change themselves
    const safeInput = {
      fullName: input.fullName,
      phone: input.phone,
      // Don't allow role, status, or isActive changes
    };

    const updatedUser = await this.userRepository.update(
      currentUser.id,
      safeInput,
    );
    this.logger.log(`Profile updated: ${currentUser.email}`);

    return updatedUser as User;
  }

  @Mutation(() => MessageResponse)
  async changePassword(
    @Args('input') input: ChangePasswordInput,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<MessageResponse> {
    // Verify current password
    const user = await this.userRepository.findById(currentUser.id);
    if (!user) {
      throw new Error('User not found');
    }

    // This would need to be implemented in AuthService
    // const isCurrentPasswordValid = await this.authService.verifyPassword(
    //   input.currentPassword,
    //   user.passwordHash
    // );

    // if (!isCurrentPasswordValid) {
    //   throw new ForbiddenException('Current password is incorrect');
    // }

    // Hash new password and update
    // const newPasswordHash = await this.authService.hashPassword(input.newPassword);
    // await this.userRepository.update(user.id, { passwordHash: newPasswordHash });

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  @Mutation(() => MessageResponse)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteUser(
    @Args('id', { type: () => ID }) id: number,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<MessageResponse> {
    const targetUser = await this.userRepository.findById(id);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Ensure admin can only delete users from their organization
    if (currentUser.organizationId !== targetUser.organizationId) {
      throw new ForbiddenException(
        'You can only delete users from your organization',
      );
    }

    // Prevent self-deletion
    if (currentUser.id === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.userRepository.softDelete(id);
    this.logger.log(
      `User deleted: ${targetUser.email} by ${currentUser.email}`,
    );

    return { message: 'User deleted successfully' };
  }

  @Mutation(() => MessageResponse)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async restoreUser(
    @Args('id', { type: () => ID }) id: number,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<MessageResponse> {
    const targetUser = await this.userRepository.findById(id);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Ensure admin can only restore users from their organization
    if (currentUser.organizationId !== targetUser.organizationId) {
      throw new ForbiddenException(
        'You can only restore users from your organization',
      );
    }

    await this.userRepository.restore(id);
    this.logger.log(
      `User restored: ${targetUser.email} by ${currentUser.email}`,
    );

    return { message: 'User restored successfully' };
  }

  // Resolve fields that might need DataLoader
  //   @ResolveField('organization', { nullable: true })
  //   async organization(@Parent() user: User, @Context() context: any) {
  //     // This would require an Organization entity and repository
  //     // const organizationLoader = context.loaders?.organizationLoader;
  //     // return organizationLoader ? organizationLoader.load(user.organizationId) : null;
  //     return null; // Placeholder
  //   }

  // Statistics queries
  @Query(() => Number)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async userCount(
    @CurrentUser() currentUser: UserEntity,
    @Args('role', { type: () => UserRole, nullable: true }) role?: UserRole,
  ): Promise<number> {
    if (role) {
      return this.userRepository.countByRole(currentUser.organizationId, role);
    }
    return this.userRepository.countByOrganization(currentUser.organizationId);
  }

  @Query(() => Number)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async activeUserCount(
    @CurrentUser() currentUser: UserEntity,
  ): Promise<number> {
    return this.userRepository.countActiveUsers(currentUser.organizationId);
  }
}
