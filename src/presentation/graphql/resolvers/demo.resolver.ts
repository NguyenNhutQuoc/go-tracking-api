import { Query, Resolver } from '@nestjs/graphql';
import { User } from '../types/demo.type';

@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  users(): User[] {
    // Mock data for demonstration
    return [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date(),
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        createdAt: new Date(),
      },
    ];
  }

  @Query(() => User, { nullable: true })
  user(): User | null {
    return {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date(),
    };
  }
}
