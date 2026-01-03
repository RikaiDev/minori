/**
 * Tests for authorization context.
 */

import { describe, expect, test } from 'bun:test';
import {
  createAuthContext,
  requirePermission,
  canAccessResource,
  requireResourceAccess,
  getQueryScope,
  requireTenantMatch,
  AuthorizationError,
  TenantIsolationError,
} from './auth-context';
import type { TenantContext } from '@minori/shared';

// Helper to create a test context
function createTestContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: 'user_1',
    role: 'farmer',
    cooperativeId: 'coop_1',
    locale: 'zh-TW',
    ...overrides,
  };
}

describe('createAuthContext', () => {
  test('creates context with farmer permissions', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(ctx.isAdmin).toBe(false);
    expect(ctx.permissions.length).toBeGreaterThan(0);
    expect(ctx.hasPermission('record:create')).toBe(true);
    expect(ctx.hasPermission('record:read')).toBe(true);
  });

  test('creates context with admin permissions', () => {
    const ctx = createAuthContext(createTestContext({ role: 'cooperative_admin' }));

    expect(ctx.isAdmin).toBe(true);
    expect(ctx.hasPermission('member:invite')).toBe(true);
    expect(ctx.hasPermission('cooperative:update')).toBe(true);
  });

  test('creates context with staff permissions', () => {
    const ctx = createAuthContext(createTestContext({ role: 'cooperative_staff' }));

    expect(ctx.isAdmin).toBe(false);
    expect(ctx.hasPermission('record:read')).toBe(true);
    expect(ctx.hasPermission('member:invite')).toBe(false);
  });

  test('creates context with customer permissions', () => {
    const ctx = createAuthContext(createTestContext({ role: 'customer' }));

    expect(ctx.isAdmin).toBe(false);
    expect(ctx.hasPermission('demand:create')).toBe(true);
    expect(ctx.hasPermission('record:create')).toBe(false);
  });
});

describe('hasPermission', () => {
  test('returns true for matching action', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(ctx.hasPermission('record:create')).toBe(true);
  });

  test('returns false for non-matching action', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(ctx.hasPermission('member:invite')).toBe(false);
  });

  test('cooperative scope includes own scope', () => {
    const ctx = createAuthContext(createTestContext({ role: 'cooperative_admin' }));

    expect(ctx.hasPermission('record:read', 'own')).toBe(true);
    expect(ctx.hasPermission('record:read', 'cooperative')).toBe(true);
  });

  test('own scope does not include cooperative scope', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(ctx.hasPermission('record:read', 'own')).toBe(true);
    expect(ctx.hasPermission('record:read', 'cooperative')).toBe(false);
  });
});

describe('requirePermission', () => {
  test('does not throw for valid permission', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(() => requirePermission(ctx, 'record:create')).not.toThrow();
  });

  test('throws AuthorizationError for invalid permission', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    expect(() => requirePermission(ctx, 'member:invite')).toThrow(AuthorizationError);
  });
});

describe('canAccessResource', () => {
  test('returns true when user owns resource', () => {
    const ctx = createAuthContext(createTestContext({ userId: 'user_1', role: 'farmer' }));

    expect(canAccessResource(ctx, 'user_1', 'record:read')).toBe(true);
  });

  test('returns false when user does not own resource', () => {
    const ctx = createAuthContext(createTestContext({ userId: 'user_1', role: 'farmer' }));

    expect(canAccessResource(ctx, 'user_2', 'record:read')).toBe(false);
  });

  test('returns true for admin accessing any resource', () => {
    const ctx = createAuthContext(
      createTestContext({ userId: 'admin_1', role: 'cooperative_admin' })
    );

    expect(canAccessResource(ctx, 'user_2', 'record:read')).toBe(true);
  });
});

describe('requireResourceAccess', () => {
  test('does not throw when user owns resource', () => {
    const ctx = createAuthContext(createTestContext({ userId: 'user_1', role: 'farmer' }));

    expect(() => requireResourceAccess(ctx, 'user_1', 'record:read')).not.toThrow();
  });

  test('throws when user does not own resource', () => {
    const ctx = createAuthContext(createTestContext({ userId: 'user_1', role: 'farmer' }));

    expect(() => requireResourceAccess(ctx, 'user_2', 'record:read')).toThrow(AuthorizationError);
  });
});

describe('getQueryScope', () => {
  test('returns cooperative scope for admin', () => {
    const ctx = createAuthContext(
      createTestContext({ cooperativeId: 'coop_1', role: 'cooperative_admin' })
    );

    const scope = getQueryScope(ctx, 'record:read');

    expect(scope.type).toBe('cooperative');
    if (scope.type === 'cooperative') {
      expect(scope.cooperativeId).toBe('coop_1');
    }
  });

  test('returns user scope for farmer', () => {
    const ctx = createAuthContext(
      createTestContext({ userId: 'user_1', cooperativeId: 'coop_1', role: 'farmer' })
    );

    const scope = getQueryScope(ctx, 'record:read');

    expect(scope.type).toBe('user');
    if (scope.type === 'user') {
      expect(scope.cooperativeId).toBe('coop_1');
      expect(scope.userId).toBe('user_1');
    }
  });

  test('returns none scope for unauthorized action', () => {
    const ctx = createAuthContext(createTestContext({ role: 'farmer' }));

    const scope = getQueryScope(ctx, 'member:invite');

    expect(scope.type).toBe('none');
  });
});

describe('requireTenantMatch', () => {
  test('does not throw when cooperative IDs match', () => {
    const ctx = createAuthContext(createTestContext({ cooperativeId: 'coop_1' }));

    expect(() => requireTenantMatch(ctx, 'coop_1')).not.toThrow();
  });

  test('throws TenantIsolationError when cooperative IDs do not match', () => {
    const ctx = createAuthContext(createTestContext({ cooperativeId: 'coop_1' }));

    expect(() => requireTenantMatch(ctx, 'coop_2')).toThrow(TenantIsolationError);
  });

  test('TenantIsolationError contains both cooperative IDs', () => {
    const ctx = createAuthContext(createTestContext({ cooperativeId: 'coop_1' }));

    try {
      requireTenantMatch(ctx, 'coop_2');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(TenantIsolationError);
      if (error instanceof TenantIsolationError) {
        expect(error.requestedCooperativeId).toBe('coop_2');
        expect(error.userCooperativeId).toBe('coop_1');
      }
    }
  });
});
