import { InputType, Field, ID } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsNumber,
  IsEmail,
} from 'class-validator';
import { IsPhoneNumber } from '../../../infrastructure/decorators/phone-validation.decorator';
import { UserRole } from '../../../core/domain/entities/user.entity';
import { OtpType } from '../../../infrastructure/services/otp/otp.service';
import { Transform } from 'class-transformer';
import { PhoneUtil } from '../../../infrastructure/utils/phone.util';

@InputType()
export class LoginInput {
  @Field({ description: 'Phone number (+84xxxxxxxxx)' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsNumber()
  organizationId?: number;
}

@InputType()
export class RegisterInput {
  @Field({ description: 'Phone number (+84xxxxxxxxx)' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;

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

  @Field({ nullable: true, description: 'Optional email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

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
  @Field({ description: 'Phone number' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;

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
  @Field({ description: 'Phone number' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;
}

@InputType()
export class ResetPasswordInput {
  @Field({ description: 'Phone number' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;

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
export class SendOtpInput {
  @Field({ description: 'Phone number' })
  @IsPhoneNumber()
  @Transform(({ value }) => PhoneUtil.normalize(value))
  phone: string;

  @Field(() => OtpType)
  @IsEnum(OtpType)
  type: OtpType;
}
