// src/presentation/graphql/inputs/user.input.ts
import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import {
  UserRole,
  UserStatus,
} from '../../../core/domain/entities/user.entity';
import { OtpType } from '../../../infrastructure/services/otp/otp.service';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  organizationId?: number;
}

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @Field()
  @IsNumber()
  organizationId: number;

  @Field(() => UserRole, { nullable: true, defaultValue: UserRole.VISITOR })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@InputType()
export class VerifyOtpInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @Field(() => OtpType)
  @IsEnum(OtpType)
  type: OtpType;
}

@InputType()
export class ForgotPasswordInput {
  @Field()
  @IsEmail()
  email: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  organizationId?: number;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  newPassword: string;
}

@InputType()
export class RefreshTokenInput {
  @Field()
  @IsString()
  refreshToken: string;
}

@InputType()
export class SendOtpInput {
  @Field()
  @IsEmail()
  email: string;

  @Field(() => OtpType)
  @IsEnum(OtpType)
  type: OtpType;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class UserFiltersInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  organizationId?: number;

  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  @IsString()
  currentPassword: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  newPassword: string;
}
