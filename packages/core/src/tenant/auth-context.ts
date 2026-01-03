/**
 * Authorization Context
 *
 * Creates and manages authorization context for multi-tenant operations.
 * Provides permission checking and tenant isolation enforcement.
 */

import {
  ROLE_PERMISSIONS,
  type AuthContext,
  type TenantContext,
  type UserRole,
  type Permission,
  type PermissionAction,
  type PermissionScope,
} from '@minori/shared';

/**
 * Creates an authorization context from a tenant context.
 *
 * @param ctx - The basic tenant context
 * @param rolePermissions - Role permission matrix (defaults to ROLE_PERMISSIONS)
 * @returns Full authorization context with permission checking
 */
export function createAuthContext(
  ctx: TenantContext,
  rolePermissions: Record<UserRole, Permission[]> = ROLE_PERMISSIONS
): AuthContext {
  const permissions = rolePermissions[ctx.role] ?? [];
  const isAdmin = ctx.role === 'cooperative_admin';

  const hasPermission = (action: PermissionAction, scope?: PermissionScope): boolean => {
    return permissions.some((p) => {
      // Action must match
      if (p.action !== action) return false;

      // If no scope specified, just check action
      if (!scope) return true;

      // Check scope hierarchy: cooperative > own
      if (p.scope === 'cooperative') return true;
      if (p.scope === scope) return true;

      return false;
    });
  };

  return {
    ...ctx,
    permissions,
    isAdmin,
    hasPermission,
  };
}

/**
 * Validates that a user has permission to perform an action.
 *
 * @param ctx - Authorization context
 * @param action - Action to check
 * @param scope - Optional scope requirement
 * @throws Error if permission is denied
 */
export function requirePermission(
  ctx: AuthContext,
  action: PermissionAction,
  scope?: PermissionScope
): void {
  if (!ctx.hasPermission(action, scope)) {
    throw new AuthorizationError(
      `Permission denied: ${action}${scope ? ` (scope: ${scope})` : ''}`
    );
  }
}

/**
 * Checks if a user can access a resource owned by another user.
 *
 * @param ctx - Authorization context
 * @param resourceOwnerId - User ID of the resource owner
 * @param action - Action being performed
 * @returns Whether access is allowed
 */
export function canAccessResource(
  ctx: AuthContext,
  resourceOwnerId: string,
  action: PermissionAction
): boolean {
  // Check if user has cooperative-wide access
  if (ctx.hasPermission(action, 'cooperative')) {
    return true;
  }

  // Check if user has own-resource access and is the owner
  if (ctx.hasPermission(action, 'own') && ctx.userId === resourceOwnerId) {
    return true;
  }

  return false;
}

/**
 * Validates that a user can access a resource.
 *
 * @param ctx - Authorization context
 * @param resourceOwnerId - User ID of the resource owner
 * @param action - Action being performed
 * @throws Error if access is denied
 */
export function requireResourceAccess(
  ctx: AuthContext,
  resourceOwnerId: string,
  action: PermissionAction
): void {
  if (!canAccessResource(ctx, resourceOwnerId, action)) {
    throw new AuthorizationError(
      `Access denied: Cannot ${action} resource owned by user ${resourceOwnerId}`
    );
  }
}

/**
 * Gets the scope filter for database queries based on user role.
 * Returns filters that should be applied to queries to enforce tenant isolation.
 *
 * @param ctx - Authorization context
 * @param action - Action being performed
 * @returns Query filters
 */
export function getQueryScope(ctx: AuthContext, action: PermissionAction): QueryScope {
  // Check if user has cooperative-wide access for this action
  if (ctx.hasPermission(action, 'cooperative')) {
    return {
      type: 'cooperative',
      cooperativeId: ctx.cooperativeId,
    };
  }

  // Check if user has own-resource access
  if (ctx.hasPermission(action, 'own')) {
    return {
      type: 'user',
      cooperativeId: ctx.cooperativeId,
      userId: ctx.userId,
    };
  }

  // No access - return empty scope
  return {
    type: 'none',
  };
}

/**
 * Query scope for database operations.
 */
export type QueryScope =
  | { type: 'cooperative'; cooperativeId: string }
  | { type: 'user'; cooperativeId: string; userId: string }
  | { type: 'none' };

/**
 * Authorization error for permission denials.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Tenant isolation error for cross-tenant access attempts.
 */
export class TenantIsolationError extends Error {
  constructor(
    public readonly requestedCooperativeId: string,
    public readonly userCooperativeId: string
  ) {
    super(
      `Tenant isolation violation: User from cooperative ${userCooperativeId} ` +
        `attempted to access data from cooperative ${requestedCooperativeId}`
    );
    this.name = 'TenantIsolationError';
  }
}

/**
 * Validates that a cooperative ID matches the user's cooperative.
 *
 * @param ctx - Authorization context
 * @param cooperativeId - Cooperative ID being accessed
 * @throws TenantIsolationError if IDs don't match
 */
export function requireTenantMatch(ctx: AuthContext, cooperativeId: string): void {
  if (ctx.cooperativeId !== cooperativeId) {
    throw new TenantIsolationError(cooperativeId, ctx.cooperativeId);
  }
}

// Re-export ROLE_PERMISSIONS for convenience
export { ROLE_PERMISSIONS };
