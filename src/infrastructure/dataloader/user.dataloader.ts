// src/infrastructure/dataloader/user.dataloader.ts
import { Inject, Injectable } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { UserRepositoryInterface } from '../../core/domain/repositories/user.repository.interface';
import { User } from '../../core/domain/entities/user.entity';
import { USER_REPOSITORY_TOKEN } from 'src/core/application/services/auth.service';

@Injectable()
export class UserDataLoaderService {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepositoryInterface,
  ) {}

  createUserLoader(): DataLoader<number, User | null> {
    return new DataLoader<number, User | null>(
      async (userIds: readonly number[]) => {
        const users = await this.userRepository.findByIds([...userIds]);

        // Create a map for O(1) lookup
        const userMap = new Map<number, User>();
        users.forEach((user) => {
          userMap.set(user.id, user);
        });

        // Return users in the same order as requested IDs
        return userIds.map((id) => userMap.get(id) || null);
      },
      {
        // Cache results for the duration of the request
        cache: true,
        // Batch requests within 10ms
        batchScheduleFn: (callback) => setTimeout(callback, 10),
        // Max batch size
        maxBatchSize: 100,
      },
    );
  }

  createUsersByOrganizationLoader(): DataLoader<number, User[]> {
    return new DataLoader<number, User[]>(
      async (organizationIds: readonly number[]) => {
        // Get all users for these organizations
        const allUsers = await Promise.all(
          organizationIds.map((orgId) =>
            this.userRepository.findByOrganization(orgId),
          ),
        );

        return allUsers;
      },
      {
        cache: true,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
        maxBatchSize: 50,
      },
    );
  }

  createUserCountByOrganizationLoader(): DataLoader<number, number> {
    return new DataLoader<number, number>(
      async (organizationIds: readonly number[]) => {
        const counts = await Promise.all(
          organizationIds.map((orgId) =>
            this.userRepository.countByOrganization(orgId),
          ),
        );

        return counts;
      },
      {
        cache: true,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
        maxBatchSize: 50,
      },
    );
  }
}
