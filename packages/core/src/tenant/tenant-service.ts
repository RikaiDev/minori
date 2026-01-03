/**
 * Tenant Service
 *
 * Manages multi-tenant operations including cooperative onboarding,
 * member invitations, and data sharing configuration.
 */

import { eq, and, gt } from 'drizzle-orm';
import {
  getDatabase,
  cooperatives,
  users,
  memberInvitations,
  dataSharingConfigs,
  type Database,
} from '@minori/database';
import type {
  AuthContext,
  CooperativeOnboardingRequest,
  CooperativeOnboardingResult,
  MemberInvitation,
  DataSharingConfig,
  UserRole,
  TaiwanRegion,
} from '@minori/shared';
import { requirePermission, AuthorizationError } from './auth-context';

/**
 * Generates a random alphanumeric code of specified length.
 */
function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Service for managing tenant operations.
 */
export class TenantService {
  private db: Database;

  constructor(db?: Database) {
    this.db = db ?? getDatabase();
  }

  // ============================================
  // Cooperative Onboarding
  // ============================================

  /**
   * Creates a new cooperative with an initial admin user.
   * This is an unauthenticated operation for new cooperative registration.
   *
   * @param request - Onboarding request
   * @returns Onboarding result
   */
  async onboardCooperative(
    request: CooperativeOnboardingRequest
  ): Promise<CooperativeOnboardingResult> {
    // Check if code already exists
    const existingCoop = await this.db
      .select({ id: cooperatives.id })
      .from(cooperatives)
      .where(eq(cooperatives.code, request.code))
      .limit(1);

    if (existingCoop.length > 0) {
      return {
        cooperativeId: '',
        adminUserId: '',
        joinCode: '',
        success: false,
        error: 'Cooperative code already exists',
      };
    }

    // Check if LINE user is already registered
    const existingUser = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.lineUserId, request.adminLineUserId))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        cooperativeId: '',
        adminUserId: '',
        joinCode: '',
        success: false,
        error: 'LINE user already registered',
      };
    }

    // Create cooperative
    const newCooperatives = await this.db
      .insert(cooperatives)
      .values({
        name: request.name,
        code: request.code,
        region: request.region,
        email: request.email,
        phone: request.phone,
        address: request.address,
      })
      .returning({ id: cooperatives.id });

    const newCooperative = newCooperatives[0];
    if (!newCooperative) {
      throw new Error('Failed to create cooperative');
    }

    // Create admin user
    const newUsers = await this.db
      .insert(users)
      .values({
        lineUserId: request.adminLineUserId,
        cooperativeId: newCooperative.id,
        role: 'cooperative_admin',
        name: request.adminName,
      })
      .returning({ id: users.id });

    const newUser = newUsers[0];
    if (!newUser) {
      throw new Error('Failed to create admin user');
    }

    // Create default data sharing config (all disabled)
    await this.db.insert(dataSharingConfigs).values({
      cooperativeId: newCooperative.id,
      shareSupplyData: false,
      acceptExternalDemands: false,
      shareFarmerProfiles: false,
    });

    return {
      cooperativeId: newCooperative.id,
      adminUserId: newUser.id,
      joinCode: request.code,
      success: true,
    };
  }

  /**
   * Gets cooperative by ID.
   */
  async getCooperativeById(cooperativeId: string): Promise<{
    id: string;
    name: string;
    code: string;
    region: TaiwanRegion;
  } | null> {
    const [coop] = await this.db
      .select({
        id: cooperatives.id,
        name: cooperatives.name,
        code: cooperatives.code,
        region: cooperatives.region,
      })
      .from(cooperatives)
      .where(eq(cooperatives.id, cooperativeId))
      .limit(1);

    if (!coop) return null;
    return {
      id: coop.id,
      name: coop.name,
      code: coop.code,
      region: coop.region as TaiwanRegion,
    };
  }

  /**
   * Gets cooperative by join code.
   */
  async getCooperativeByCode(code: string): Promise<{
    id: string;
    name: string;
    region: TaiwanRegion;
  } | null> {
    const [coop] = await this.db
      .select({
        id: cooperatives.id,
        name: cooperatives.name,
        region: cooperatives.region,
      })
      .from(cooperatives)
      .where(eq(cooperatives.code, code))
      .limit(1);

    if (!coop) return null;
    return {
      id: coop.id,
      name: coop.name,
      region: coop.region as TaiwanRegion,
    };
  }

  // ============================================
  // Member Management
  // ============================================

  /**
   * Creates an invitation for a new member to join the cooperative.
   *
   * @param ctx - Authorization context (must be admin)
   * @param role - Role to assign to the new member
   * @param inviteeName - Optional name of the invitee
   * @param inviteeEmail - Optional email of the invitee
   * @param expiresInDays - Days until invitation expires (default: 7)
   * @returns Created invitation
   */
  async createInvitation(
    ctx: AuthContext,
    role: UserRole,
    inviteeName?: string,
    inviteeEmail?: string,
    expiresInDays: number = 7
  ): Promise<MemberInvitation> {
    requirePermission(ctx, 'member:invite', 'cooperative');

    // Cannot create admin invitations unless you're an admin
    if (role === 'cooperative_admin' && !ctx.isAdmin) {
      throw new AuthorizationError('Only admins can invite other admins');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
    const code = generateCode(6);

    const invitations = await this.db
      .insert(memberInvitations)
      .values({
        cooperativeId: ctx.cooperativeId,
        invitedBy: ctx.userId,
        role: role as 'farmer' | 'cooperative_admin' | 'cooperative_staff' | 'customer',
        code,
        inviteeName,
        inviteeEmail,
        status: 'pending',
        expiresAt,
      })
      .returning();

    const invitation = invitations[0];
    if (!invitation) {
      throw new Error('Failed to create invitation');
    }

    return {
      id: invitation.id,
      cooperativeId: invitation.cooperativeId,
      invitedBy: invitation.invitedBy,
      role: invitation.role as UserRole,
      code: invitation.code,
      expiresAt: invitation.expiresAt,
      used: invitation.status !== 'pending',
      createdAt: invitation.createdAt,
    };
  }

  /**
   * Gets pending invitations for the cooperative.
   */
  async getPendingInvitations(ctx: AuthContext): Promise<MemberInvitation[]> {
    requirePermission(ctx, 'member:read', 'cooperative');

    const now = new Date();
    const invitations = await this.db
      .select()
      .from(memberInvitations)
      .where(
        and(
          eq(memberInvitations.cooperativeId, ctx.cooperativeId),
          eq(memberInvitations.status, 'pending'),
          gt(memberInvitations.expiresAt, now)
        )
      );

    return invitations.map((inv) => ({
      id: inv.id,
      cooperativeId: inv.cooperativeId,
      invitedBy: inv.invitedBy,
      role: inv.role as UserRole,
      code: inv.code,
      expiresAt: inv.expiresAt,
      used: inv.status !== 'pending',
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Accepts an invitation using the invitation code.
   * This is called when a new user wants to join a cooperative.
   *
   * @param lineUserId - LINE user ID of the new member
   * @param invitationCode - Invitation code
   * @param name - Display name
   * @returns Created user or error
   */
  async acceptInvitation(
    lineUserId: string,
    invitationCode: string,
    name?: string
  ): Promise<{
    success: boolean;
    userId?: string;
    cooperativeId?: string;
    role?: UserRole;
    error?: string;
  }> {
    // Find invitation by code
    const [invitation] = await this.db
      .select()
      .from(memberInvitations)
      .where(eq(memberInvitations.code, invitationCode))
      .limit(1);

    if (!invitation) {
      return { success: false, error: 'Invalid invitation code' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, error: 'Invitation has already been used' };
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: 'Invitation has expired' };
    }

    // Check if LINE user already exists
    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.lineUserId, lineUserId))
      .limit(1);

    if (existingUser) {
      return { success: false, error: 'User already registered' };
    }

    // Create user
    const newUsers = await this.db
      .insert(users)
      .values({
        lineUserId,
        cooperativeId: invitation.cooperativeId,
        role: invitation.role,
        name,
      })
      .returning({ id: users.id });

    const newUser = newUsers[0];
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    // Mark invitation as accepted
    await this.db
      .update(memberInvitations)
      .set({
        status: 'accepted',
        acceptedBy: newUser.id,
        acceptedAt: new Date(),
      })
      .where(eq(memberInvitations.id, invitation.id));

    return {
      success: true,
      userId: newUser.id,
      cooperativeId: invitation.cooperativeId,
      role: invitation.role as UserRole,
    };
  }

  /**
   * Joins a cooperative directly using the cooperative code.
   * New members join as farmers by default.
   *
   * @param lineUserId - LINE user ID
   * @param cooperativeCode - Cooperative join code
   * @param name - Display name
   * @returns Created user or error
   */
  async joinCooperative(
    lineUserId: string,
    cooperativeCode: string,
    name?: string
  ): Promise<{
    success: boolean;
    userId?: string;
    cooperativeId?: string;
    error?: string;
  }> {
    // Find cooperative by code
    const cooperative = await this.getCooperativeByCode(cooperativeCode);
    if (!cooperative) {
      return { success: false, error: 'Invalid cooperative code' };
    }

    // Check if LINE user already exists
    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.lineUserId, lineUserId))
      .limit(1);

    if (existingUser) {
      return { success: false, error: 'User already registered' };
    }

    // Create user as farmer
    const newUsers = await this.db
      .insert(users)
      .values({
        lineUserId,
        cooperativeId: cooperative.id,
        role: 'farmer',
        name,
      })
      .returning({ id: users.id });

    const newUser = newUsers[0];
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return {
      success: true,
      userId: newUser.id,
      cooperativeId: cooperative.id,
    };
  }

  /**
   * Gets members of the cooperative.
   */
  async getMembers(ctx: AuthContext): Promise<
    Array<{
      id: string;
      name?: string;
      role: UserRole;
      createdAt: Date;
    }>
  > {
    requirePermission(ctx, 'member:read', 'cooperative');

    const members = await this.db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.cooperativeId, ctx.cooperativeId));

    return members.map((member) => ({
      id: member.id,
      name: member.name ?? undefined,
      role: member.role as UserRole,
      createdAt: member.createdAt,
    }));
  }

  /**
   * Updates a member's role.
   */
  async updateMemberRole(ctx: AuthContext, memberId: string, newRole: UserRole): Promise<boolean> {
    requirePermission(ctx, 'member:update', 'cooperative');

    // Only admins can change roles
    if (!ctx.isAdmin) {
      throw new AuthorizationError('Only admins can change member roles');
    }

    // Cannot demote yourself
    if (memberId === ctx.userId && newRole !== 'cooperative_admin') {
      throw new AuthorizationError('Cannot demote yourself');
    }

    // Check if user exists and belongs to the cooperative
    const [user] = await this.db
      .select({ id: users.id, cooperativeId: users.cooperativeId })
      .from(users)
      .where(eq(users.id, memberId))
      .limit(1);

    if (!user || user.cooperativeId !== ctx.cooperativeId) {
      return false;
    }

    await this.db
      .update(users)
      .set({
        role: newRole as 'farmer' | 'cooperative_admin' | 'cooperative_staff' | 'customer',
      })
      .where(eq(users.id, memberId));

    return true;
  }

  // ============================================
  // Data Sharing Configuration
  // ============================================

  /**
   * Gets the data sharing configuration for the cooperative.
   */
  async getDataSharingConfig(ctx: AuthContext): Promise<DataSharingConfig | null> {
    requirePermission(ctx, 'cooperative:read', 'cooperative');

    const [config] = await this.db
      .select()
      .from(dataSharingConfigs)
      .where(eq(dataSharingConfigs.cooperativeId, ctx.cooperativeId))
      .limit(1);

    if (!config) return null;

    return {
      cooperativeId: config.cooperativeId,
      shareSupplyData: config.shareSupplyData,
      acceptExternalDemands: config.acceptExternalDemands,
      sharedWithCooperatives: [], // Populated from cooperativeSharingRelations in production
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Updates the data sharing configuration.
   */
  async updateDataSharingConfig(
    ctx: AuthContext,
    config: Partial<Omit<DataSharingConfig, 'cooperativeId' | 'updatedAt'>>
  ): Promise<DataSharingConfig> {
    requirePermission(ctx, 'cooperative:manage_sharing', 'cooperative');

    // Check if config exists
    const [existing] = await this.db
      .select()
      .from(dataSharingConfigs)
      .where(eq(dataSharingConfigs.cooperativeId, ctx.cooperativeId))
      .limit(1);

    if (!existing) {
      // Create new config
      const newConfigs = await this.db
        .insert(dataSharingConfigs)
        .values({
          cooperativeId: ctx.cooperativeId,
          shareSupplyData: config.shareSupplyData ?? false,
          acceptExternalDemands: config.acceptExternalDemands ?? false,
          shareFarmerProfiles: false,
        })
        .returning();

      const newConfig = newConfigs[0];
      if (!newConfig) {
        throw new Error('Failed to create data sharing config');
      }

      return {
        cooperativeId: newConfig.cooperativeId,
        shareSupplyData: newConfig.shareSupplyData,
        acceptExternalDemands: newConfig.acceptExternalDemands,
        sharedWithCooperatives: [],
        updatedAt: newConfig.updatedAt,
      };
    }

    // Update existing config
    const updatedConfigs = await this.db
      .update(dataSharingConfigs)
      .set({
        shareSupplyData: config.shareSupplyData ?? existing.shareSupplyData,
        acceptExternalDemands: config.acceptExternalDemands ?? existing.acceptExternalDemands,
      })
      .where(eq(dataSharingConfigs.cooperativeId, ctx.cooperativeId))
      .returning();

    const updated = updatedConfigs[0];
    if (!updated) {
      throw new Error('Failed to update data sharing config');
    }

    return {
      cooperativeId: updated.cooperativeId,
      shareSupplyData: updated.shareSupplyData,
      acceptExternalDemands: updated.acceptExternalDemands,
      sharedWithCooperatives: config.sharedWithCooperatives ?? [],
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Gets cooperatives that share data with this cooperative.
   */
  async getSharingPartners(ctx: AuthContext): Promise<
    Array<{
      cooperativeId: string;
      cooperativeName: string;
      sharesSupplyData: boolean;
      acceptsExternalDemands: boolean;
    }>
  > {
    requirePermission(ctx, 'cooperative:read', 'cooperative');

    // In production, this would query cooperative_sharing_relations
    // For now, return empty array as cross-cooperative sharing is a future feature
    return [];
  }

  // ============================================
  // User Lookup
  // ============================================

  /**
   * Gets a user by LINE user ID.
   * Used for authentication flow.
   */
  async getUserByLineId(lineUserId: string): Promise<{
    id: string;
    cooperativeId: string;
    role: UserRole;
    name?: string;
    locale?: 'en' | 'zh-TW';
  } | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        cooperativeId: users.cooperativeId,
        role: users.role,
        name: users.name,
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.lineUserId, lineUserId))
      .limit(1);

    if (!user) return null;

    return {
      id: user.id,
      cooperativeId: user.cooperativeId,
      role: user.role as UserRole,
      name: user.name ?? undefined,
      locale: user.locale as 'en' | 'zh-TW' | undefined,
    };
  }
}

/**
 * Factory function to create a tenant service.
 */
export function createTenantService(db?: Database): TenantService {
  return new TenantService(db);
}
