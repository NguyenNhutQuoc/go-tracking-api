import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import {
  UserRole,
  UserStatus,
} from '../../../core/domain/entities/user.entity';
import { OtpType } from '../../../infrastructure/services/otp/otp.service';

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

  @Field({ description: 'Phone number (+84xxxxxxxxx)' })
  phone: string;

  @Field()
  fullName: string;

  @Field({ nullable: true, description: 'Optional email address' })
  email?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field()
  isActive: boolean;

  @Field({ description: 'Phone number verification status' })
  phoneVerified: boolean;

  @Field()
  emailVerified: boolean;

  @Field({ nullable: true })
  lastLogin?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  organizationId: number;
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
