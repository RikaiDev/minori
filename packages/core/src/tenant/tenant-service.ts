/**
 * Tenant Service
 *
 * Manages multi-tenant operations including cooperative onboarding,
 * member invitations, and data sharing configuration.
 */

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
 * Mock storage for development.
 * TODO: Replace with database operations.
 */
const MOCK_COOPERATIVES: Map<
  string,
  {
    id: string;
    name: string;
    code: string;
    region: TaiwanRegion;
    email?: string;
    phone?: string;
    address?: string;
    createdAt: Date;
  }
> = new Map();

const MOCK_USERS: Map<
  string,
  {
    id: string;
    lineUserId: string;
    cooperativeId: string;
    role: UserRole;
    name?: string;
    createdAt: Date;
  }
> = new Map();

const MOCK_INVITATIONS: Map<string, MemberInvitation> = new Map();

const MOCK_SHARING_CONFIGS: Map<string, DataSharingConfig> = new Map();

let idCounter = 1;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

/**
 * Service for managing tenant operations.
 */
export class TenantService {
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
    // Validate unique code
    for (const coop of MOCK_COOPERATIVES.values()) {
      if (coop.code === request.code) {
        return {
          cooperativeId: '',
          adminUserId: '',
          joinCode: '',
          success: false,
          error: 'Cooperative code already exists',
        };
      }
    }

    // Validate LINE user not already registered
    for (const user of MOCK_USERS.values()) {
      if (user.lineUserId === request.adminLineUserId) {
        return {
          cooperativeId: '',
          adminUserId: '',
          joinCode: '',
          success: false,
          error: 'LINE user already registered',
        };
      }
    }

    // Create cooperative
    const cooperativeId = generateId('coop');
    const now = new Date();

    MOCK_COOPERATIVES.set(cooperativeId, {
      id: cooperativeId,
      name: request.name,
      code: request.code,
      region: request.region,
      email: request.email,
      phone: request.phone,
      address: request.address,
      createdAt: now,
    });

    // Create admin user
    const adminUserId = generateId('user');
    MOCK_USERS.set(adminUserId, {
      id: adminUserId,
      lineUserId: request.adminLineUserId,
      cooperativeId,
      role: 'cooperative_admin',
      name: request.adminName,
      createdAt: now,
    });

    // Create default data sharing config (all disabled)
    MOCK_SHARING_CONFIGS.set(cooperativeId, {
      cooperativeId,
      shareSupplyData: false,
      acceptExternalDemands: false,
      sharedWithCooperatives: [],
      updatedAt: now,
    });

    return {
      cooperativeId,
      adminUserId,
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
    const coop = MOCK_COOPERATIVES.get(cooperativeId);
    if (!coop) return null;
    return {
      id: coop.id,
      name: coop.name,
      code: coop.code,
      region: coop.region,
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
    for (const coop of MOCK_COOPERATIVES.values()) {
      if (coop.code === code) {
        return {
          id: coop.id,
          name: coop.name,
          region: coop.region,
        };
      }
    }
    return null;
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
    const id = generateId('inv');

    const invitation: MemberInvitation = {
      id,
      cooperativeId: ctx.cooperativeId,
      invitedBy: ctx.userId,
      role,
      code,
      expiresAt,
      used: false,
      createdAt: now,
    };

    MOCK_INVITATIONS.set(id, invitation);

    return invitation;
  }

  /**
   * Gets pending invitations for the cooperative.
   */
  async getPendingInvitations(ctx: AuthContext): Promise<MemberInvitation[]> {
    requirePermission(ctx, 'member:read', 'cooperative');

    const now = new Date();
    const invitations: MemberInvitation[] = [];

    for (const inv of MOCK_INVITATIONS.values()) {
      if (inv.cooperativeId === ctx.cooperativeId && !inv.used && inv.expiresAt > now) {
        invitations.push(inv);
      }
    }

    return invitations;
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
    let invitation: MemberInvitation | undefined;
    for (const inv of MOCK_INVITATIONS.values()) {
      if (inv.code === invitationCode) {
        invitation = inv;
        break;
      }
    }

    if (!invitation) {
      return { success: false, error: 'Invalid invitation code' };
    }

    if (invitation.used) {
      return { success: false, error: 'Invitation has already been used' };
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: 'Invitation has expired' };
    }

    // Check if LINE user already exists
    for (const user of MOCK_USERS.values()) {
      if (user.lineUserId === lineUserId) {
        return { success: false, error: 'User already registered' };
      }
    }

    // Create user
    const userId = generateId('user');
    const now = new Date();

    MOCK_USERS.set(userId, {
      id: userId,
      lineUserId,
      cooperativeId: invitation.cooperativeId,
      role: invitation.role,
      name,
      createdAt: now,
    });

    // Mark invitation as used
    invitation.used = true;

    return {
      success: true,
      userId,
      cooperativeId: invitation.cooperativeId,
      role: invitation.role,
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
    for (const user of MOCK_USERS.values()) {
      if (user.lineUserId === lineUserId) {
        return { success: false, error: 'User already registered' };
      }
    }

    // Create user as farmer
    const userId = generateId('user');
    const now = new Date();

    MOCK_USERS.set(userId, {
      id: userId,
      lineUserId,
      cooperativeId: cooperative.id,
      role: 'farmer',
      name,
      createdAt: now,
    });

    return {
      success: true,
      userId,
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

    const members: Array<{
      id: string;
      name?: string;
      role: UserRole;
      createdAt: Date;
    }> = [];

    for (const user of MOCK_USERS.values()) {
      if (user.cooperativeId === ctx.cooperativeId) {
        members.push({
          id: user.id,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        });
      }
    }

    return members;
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

    const user = MOCK_USERS.get(memberId);
    if (!user || user.cooperativeId !== ctx.cooperativeId) {
      return false;
    }

    user.role = newRole;
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

    return MOCK_SHARING_CONFIGS.get(ctx.cooperativeId) ?? null;
  }

  /**
   * Updates the data sharing configuration.
   */
  async updateDataSharingConfig(
    ctx: AuthContext,
    config: Partial<Omit<DataSharingConfig, 'cooperativeId' | 'updatedAt'>>
  ): Promise<DataSharingConfig> {
    requirePermission(ctx, 'cooperative:manage_sharing', 'cooperative');

    let existing = MOCK_SHARING_CONFIGS.get(ctx.cooperativeId);
    if (!existing) {
      existing = {
        cooperativeId: ctx.cooperativeId,
        shareSupplyData: false,
        acceptExternalDemands: false,
        sharedWithCooperatives: [],
        updatedAt: new Date(),
      };
    }

    const updated: DataSharingConfig = {
      ...existing,
      ...config,
      cooperativeId: ctx.cooperativeId,
      updatedAt: new Date(),
    };

    MOCK_SHARING_CONFIGS.set(ctx.cooperativeId, updated);
    return updated;
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
    // For now, return empty array
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
    for (const user of MOCK_USERS.values()) {
      if (user.lineUserId === lineUserId) {
        return {
          id: user.id,
          cooperativeId: user.cooperativeId,
          role: user.role,
          name: user.name,
        };
      }
    }
    return null;
  }
}

/**
 * Factory function to create a tenant service.
 */
export function createTenantService(): TenantService {
  return new TenantService();
}
