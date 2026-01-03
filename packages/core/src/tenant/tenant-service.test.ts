/**
 * Integration tests for tenant service.
 *
 * These tests require a database connection (DATABASE_URL).
 * They are skipped when running without a database.
 */

import { describe, expect, test } from 'bun:test';

// Skip integration tests when DATABASE_URL is not available
const SKIP_INTEGRATION = !process.env.DATABASE_URL;
const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

import { TenantService, createTenantService } from './tenant-service';
import { createAuthContext } from './auth-context';
import type { TenantContext } from '@minori/shared';

// Helper to create admin context
function createAdminContext(cooperativeId: string): ReturnType<typeof createAuthContext> {
  const ctx: TenantContext = {
    userId: 'admin_1',
    role: 'cooperative_admin',
    cooperativeId,
    locale: 'zh-TW',
  };
  return createAuthContext(ctx);
}

// Helper to create farmer context
function createFarmerContext(
  cooperativeId: string,
  userId: string = 'farmer_1'
): ReturnType<typeof createAuthContext> {
  const ctx: TenantContext = {
    userId,
    role: 'farmer',
    cooperativeId,
    locale: 'zh-TW',
  };
  return createAuthContext(ctx);
}

describeIntegration('TenantService', () => {
  describe('onboardCooperative', () => {
    test('creates cooperative and admin user', async () => {
      const service = createTenantService();

      const result = await service.onboardCooperative({
        name: '測試合作社',
        code: 'TEST001',
        region: 'central',
        email: 'test@example.com',
        adminLineUserId: 'U123456',
        adminName: '管理員',
      });

      expect(result.success).toBe(true);
      expect(result.cooperativeId).toBeTruthy();
      expect(result.adminUserId).toBeTruthy();
      expect(result.joinCode).toBe('TEST001');
    });

    test('fails with duplicate cooperative code', async () => {
      const service = createTenantService();

      await service.onboardCooperative({
        name: '第一合作社',
        code: 'DUPE001',
        region: 'north',
        adminLineUserId: 'U111111',
        adminName: '管理員1',
      });

      const result = await service.onboardCooperative({
        name: '第二合作社',
        code: 'DUPE001',
        region: 'south',
        adminLineUserId: 'U222222',
        adminName: '管理員2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('fails with duplicate LINE user', async () => {
      const service = createTenantService();

      await service.onboardCooperative({
        name: '第一合作社',
        code: 'FIRST01',
        region: 'north',
        adminLineUserId: 'USAMELINE',
        adminName: '管理員',
      });

      const result = await service.onboardCooperative({
        name: '第二合作社',
        code: 'SECOND1',
        region: 'south',
        adminLineUserId: 'USAMELINE',
        adminName: '管理員',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });
  });

  describe('getCooperativeByCode', () => {
    test('finds cooperative by code', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '查詢測試',
        code: 'FIND001',
        region: 'east',
        adminLineUserId: 'UFIND001',
        adminName: '管理員',
      });

      const coop = await service.getCooperativeByCode('FIND001');

      expect(coop).toBeTruthy();
      expect(coop?.id).toBe(onboarding.cooperativeId);
      expect(coop?.name).toBe('查詢測試');
    });

    test('returns null for non-existent code', async () => {
      const service = createTenantService();

      const coop = await service.getCooperativeByCode('NOTEXIST');

      expect(coop).toBeNull();
    });
  });

  describe('createInvitation', () => {
    test('admin can create farmer invitation', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '邀請測試',
        code: 'INVITE01',
        region: 'central',
        adminLineUserId: 'UINVITE1',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const invitation = await service.createInvitation(ctx, 'farmer', '新農友');

      expect(invitation.id).toBeTruthy();
      expect(invitation.code).toHaveLength(6);
      expect(invitation.role).toBe('farmer');
      expect(invitation.used).toBe(false);
    });

    test('admin can create staff invitation', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '員工邀請',
        code: 'STAFF01',
        region: 'north',
        adminLineUserId: 'USTAFF01',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const invitation = await service.createInvitation(ctx, 'cooperative_staff');

      expect(invitation.role).toBe('cooperative_staff');
    });

    test('farmer cannot create invitation', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '權限測試',
        code: 'PERM001',
        region: 'south',
        adminLineUserId: 'UPERM001',
        adminName: '管理員',
      });

      const ctx = createFarmerContext(onboarding.cooperativeId);

      await expect(service.createInvitation(ctx, 'farmer')).rejects.toThrow();
    });
  });

  describe('acceptInvitation', () => {
    test('accepts valid invitation', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '接受邀請',
        code: 'ACCEPT01',
        region: 'central',
        adminLineUserId: 'UACCEPT1',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const invitation = await service.createInvitation(ctx, 'farmer');

      const result = await service.acceptInvitation('UNEWUSER1', invitation.code, '新用戶');

      expect(result.success).toBe(true);
      expect(result.userId).toBeTruthy();
      expect(result.cooperativeId).toBe(onboarding.cooperativeId);
      expect(result.role).toBe('farmer');
    });

    test('fails with invalid code', async () => {
      const service = createTenantService();

      const result = await service.acceptInvitation('UTEST123', 'INVALID', '測試');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('fails when invitation already used', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '重複使用',
        code: 'REUSE01',
        region: 'east',
        adminLineUserId: 'UREUSE01',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const invitation = await service.createInvitation(ctx, 'farmer');

      // First use
      await service.acceptInvitation('UFIRST01', invitation.code, '第一人');

      // Second use
      const result = await service.acceptInvitation('USECOND1', invitation.code, '第二人');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already been used');
    });
  });

  describe('joinCooperative', () => {
    test('joins cooperative as farmer', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '直接加入',
        code: 'JOIN0001',
        region: 'north',
        adminLineUserId: 'UJOIN001',
        adminName: '管理員',
      });

      const result = await service.joinCooperative('UNEWMEMB', 'JOIN0001', '新成員');

      expect(result.success).toBe(true);
      expect(result.cooperativeId).toBe(onboarding.cooperativeId);
    });

    test('fails with invalid cooperative code', async () => {
      const service = createTenantService();

      const result = await service.joinCooperative('UTEST123', 'BADCODE1', '測試');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('getMembers', () => {
    test('admin can view all members', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '成員列表',
        code: 'MEMBER01',
        region: 'central',
        adminLineUserId: 'UMEMBER1',
        adminName: '管理員',
      });

      // Add some members
      await service.joinCooperative('UFARMER1', 'MEMBER01', '農友1');
      await service.joinCooperative('UFARMER2', 'MEMBER01', '農友2');

      const ctx = createAdminContext(onboarding.cooperativeId);
      const members = await service.getMembers(ctx);

      expect(members.length).toBe(3); // Admin + 2 farmers
    });

    test('farmer cannot view members', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '權限測試',
        code: 'NOPERM01',
        region: 'south',
        adminLineUserId: 'UNOPERM1',
        adminName: '管理員',
      });

      const ctx = createFarmerContext(onboarding.cooperativeId);

      await expect(service.getMembers(ctx)).rejects.toThrow();
    });
  });

  describe('data sharing config', () => {
    test('gets default data sharing config', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '共享設定',
        code: 'SHARE001',
        region: 'east',
        adminLineUserId: 'USHARE01',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const config = await service.getDataSharingConfig(ctx);

      expect(config).toBeTruthy();
      expect(config?.shareSupplyData).toBe(false);
      expect(config?.acceptExternalDemands).toBe(false);
    });

    test('admin can update data sharing config', async () => {
      const service = createTenantService();

      const onboarding = await service.onboardCooperative({
        name: '更新共享',
        code: 'UPDATE01',
        region: 'north',
        adminLineUserId: 'UUPDATE1',
        adminName: '管理員',
      });

      const ctx = createAdminContext(onboarding.cooperativeId);
      const updated = await service.updateDataSharingConfig(ctx, {
        shareSupplyData: true,
        acceptExternalDemands: true,
      });

      expect(updated.shareSupplyData).toBe(true);
      expect(updated.acceptExternalDemands).toBe(true);
    });
  });

  describe('getUserByLineId', () => {
    test('finds user by LINE ID', async () => {
      const service = createTenantService();

      await service.onboardCooperative({
        name: '用戶查詢',
        code: 'LOOKUP01',
        region: 'central',
        adminLineUserId: 'ULOOKUP1',
        adminName: '測試管理員',
      });

      const user = await service.getUserByLineId('ULOOKUP1');

      expect(user).toBeTruthy();
      expect(user?.role).toBe('cooperative_admin');
      expect(user?.name).toBe('測試管理員');
    });

    test('returns null for unknown LINE ID', async () => {
      const service = createTenantService();

      const user = await service.getUserByLineId('UNKNOWN123');

      expect(user).toBeNull();
    });
  });
});

describeIntegration('createTenantService', () => {
  test('creates service instance', () => {
    const service = createTenantService();

    expect(service).toBeInstanceOf(TenantService);
  });
});
