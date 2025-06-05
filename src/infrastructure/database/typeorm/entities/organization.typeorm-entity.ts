// src/infrastructure/database/typeorm/entities/organization.typeorm-entity.ts
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseTypeormEntity } from './base.typeorm-entity';
import { UserTypeormEntity } from './user.typeorm-entity';

export enum OrganizationType {
  HOSPITAL = 'hospital',
  UNIVERSITY = 'university',
  MALL = 'mall',
  FACTORY = 'factory',
  OFFICE = 'office',
  OTHER = 'other',
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export interface OrganizationSettings {
  maxUsers?: number;
  maxBuildings?: number;
  trackingEnabled?: boolean;
  analyticsEnabled?: boolean;
  realTimeEnabled?: boolean;
  customBranding?: boolean;
  apiAccess?: boolean;
  supportLevel?: 'basic' | 'premium' | 'enterprise';
  dataRetentionDays?: number;
  features?: string[];
}

@Entity('organizations')
export class OrganizationTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: OrganizationType,
    default: OrganizationType.OTHER,
  })
  type: OrganizationType;

  @Column({
    name: 'subscription_plan',
    type: 'enum',
    enum: SubscriptionPlan,
    nullable: true,
  })
  subscriptionPlan?: SubscriptionPlan;

  @Column({ name: 'subscription_start_date', type: 'date', nullable: true })
  subscriptionStartDate?: Date;

  @Column({ name: 'subscription_end_date', type: 'date', nullable: true })
  subscriptionEndDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  settings?: OrganizationSettings;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail?: string;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contactPhone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'Asia/Ho_Chi_Minh',
  })
  timezone?: string;

  // Relations
  @OneToMany(() => UserTypeormEntity, (user) => user.organization)
  users: UserTypeormEntity[];
}
