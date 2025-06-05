// src/core/domain/entities/organization.entity.ts
import { BaseEntity } from './base.entity';

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

export class Organization extends BaseEntity {
  name: string;
  type: OrganizationType;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  settings?: OrganizationSettings;
  isActive: boolean;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  timezone?: string;

  constructor(partial: Partial<Organization>) {
    super(partial);
    Object.assign(this, partial);
  }

  isSubscriptionActive(): boolean {
    if (!this.subscriptionEndDate) return false;
    return this.subscriptionEndDate > new Date();
  }

  canCreateUsers(): boolean {
    const maxUsers = this.settings?.maxUsers || 0;
    return this.isActive && this.isSubscriptionActive() && maxUsers > 0;
  }

  canCreateBuildings(): boolean {
    const maxBuildings = this.settings?.maxBuildings || 0;
    return this.isActive && this.isSubscriptionActive() && maxBuildings > 0;
  }

  hasFeature(feature: string): boolean {
    return this.settings?.features?.includes(feature) || false;
  }

  getDataRetentionDays(): number {
    return this.settings?.dataRetentionDays || 90;
  }
}
