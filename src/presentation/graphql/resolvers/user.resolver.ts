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
import { User, MessageResponse } from '../types/user.types';
import {} from '../inputs/user.input';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { UserDataLoaderService } from '../../../infrastructure/dataloader/user.dataloader';
import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';

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

  @Mutation(() => MessageResponse)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteUser(
    @Args('id', { type: () => ID }) id: number,
    @CurrentUser() currentUser: UserEntity,
  ): Promise<MessageResponse> {
    try {
      const targetUser = await this.userRepository.findById(id);
      if (!targetUser) {
        throw new GraphQLError('Không tìm thấy người dùng', {
          extensions: {
            code: 'BIZ_003',
            category: 'business',
            severity: 'medium',
            suggestion: 'Không tìm thấy dữ liệu yêu cầu',
            retryable: false,
          },
        });
      }

      // Ensure admin can only delete users from their organization
      if (currentUser.organizationId !== targetUser.organizationId) {
        throw new GraphQLError(
          'Bạn chỉ có thể xóa người dùng trong tổ chức của mình',
          {
            extensions: {
              code: 'BIZ_004',
              category: 'permission',
              severity: 'high',
              suggestion: 'Bạn không có quyền thực hiện thao tác này',
              retryable: false,
            },
          },
        );
      }

      // Prevent self-deletion
      if (currentUser.id === id) {
        throw new GraphQLError('Bạn không thể xóa chính tài khoản của mình', {
          extensions: {
            code: 'BIZ_006',
            category: 'business',
            severity: 'medium',
            suggestion:
              'Thao tác này không được phép trong tình huống hiện tại',
            retryable: false,
          },
        });
      }

      await this.userRepository.softDelete(id);
      this.logger.log(
        `User deleted: ${targetUser.email} by ${currentUser.email}`,
      );

      return { message: 'User deleted successfully' };
    } catch (error) {
      // If it's already a GraphQLError, re-throw it
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Convert other errors
      throw new GraphQLError('Đã xảy ra lỗi khi xóa người dùng', {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          category: 'system',
          severity: 'critical',
          suggestion: 'Vui lòng thử lại sau ít phút',
          retryable: true,
          originalMessage: error.message,
        },
      });
    }
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
