// src/presentation/graphql/types/user.type.ts
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import {
  UserRole,
  UserStatus,
} from '../../../core/domain/entities/user.entity';
import { OtpType } from '../../../infrastructure/services/otp/otp.service';
import { PaginationMeta } from './pagination.type';

// Register enums for GraphQL
registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role in the organization',
});

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'User account status',
});

registerEnumType(OtpType, {
  name: 'OtpType',
  description: 'Type of OTP verification',
});

@ObjectType()
export class User {
  @Field(() => ID)
  id: number;

  @Field()
  email: string;

  @Field()
  fullName: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field()
  isActive: boolean;

  @Field()
  emailVerified: boolean;

  @Field()
  phoneVerified: boolean;

  @Field({ nullable: true })
  lastLogin?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  organizationId: number;

  // Don't expose sensitive fields like passwordHash, tokens, etc.
}

@ObjectType()
export class AuthResult {
  @Field(() => User)
  user: User;

  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field()
  expiresIn: number;
}

@ObjectType()
export class MessageResponse {
  @Field()
  message: string;
}

@ObjectType()
export class RateLimitInfo {
  @Field()
  allowed: boolean;

  @Field()
  remainingRequests: number;

  @Field()
  resetTime: Date;
}

@ObjectType()
export class UserPaginatedResponse {
  @Field(() => [User])
  items: User[];

  @Field(() => PaginationMeta)
  meta: PaginationMeta;
}
