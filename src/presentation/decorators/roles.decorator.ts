// src/presentation/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../core/domain/entities/user.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
