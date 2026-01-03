/**
 * Tenant Module
 *
 * Multi-tenant architecture components for cooperative isolation
 * and cross-cooperative data sharing.
 */

// Authorization Context
export {
  createAuthContext,
  requirePermission,
  canAccessResource,
  requireResourceAccess,
  getQueryScope,
  requireTenantMatch,
  AuthorizationError,
  TenantIsolationError,
  type QueryScope,
} from './auth-context';

// Tenant Service
export { TenantService, createTenantService } from './tenant-service';
