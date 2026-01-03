/**
 * @minori/shared
 *
 * Shared types, utilities, and internationalization for the minori platform.
 */

// ============================================================
// Internationalization
// ============================================================

export * from './i18n';

// ============================================================
// Crop Types
// ============================================================

export type CropCategory = 'leafy' | 'root' | 'gourd' | 'fruit' | 'grain' | 'herb' | 'legume';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Taiwan agricultural regions for regional variations.
 */
export type TaiwanRegion = 'north' | 'central' | 'south' | 'east';

/**
 * Regional adjustment for crop growth parameters.
 */
export interface RegionalAdjustment {
  region: TaiwanRegion;
  /** Days adjustment (positive = longer, negative = shorter) */
  daysAdjustment?: number;
  /** Season overrides for this region */
  seasons?: Season[];
  /** Yield multiplier (1.0 = no change, 1.2 = 20% more) */
  yieldMultiplier?: number;
  /** Region-specific notes */
  notes?: string;
}

export interface CropInfo {
  id: string;
  name: string;
  aliases: string[];
  category: CropCategory;
  growth: {
    daysMin: number;
    daysMax: number;
    daysOptimal: number;
    temperatureMin: number;
    temperatureMax: number;
    temperatureOptimal: number;
  };
  seasons: Season[];
  yield: {
    perArea: number; // Yield per plot (kg)
    variance: number;
  };
  commonPests: string[];
  /** Common diseases affecting this crop */
  commonDiseases?: string[];
  /** Regional variations for different parts of Taiwan */
  regions?: RegionalAdjustment[];
  /** Planting tips and best practices */
  plantingTips?: string[];
  notes?: string;
}

// ============================================================
// Intent Types
// ============================================================

export type IntentAction =
  | 'record_planting'
  | 'record_growth'
  | 'record_harvest'
  | 'query_crops'
  | 'query_forecast'
  | 'query_price'
  | 'query_member_crops'
  | 'query_supply'
  | 'export_report'
  | 'confirm'
  | 'cancel'
  | 'help'
  | 'unknown';

export type AreaUnit = 'plot' | 'jia' | 'ping' | 'hectare';
export type QuantityUnit = 'kg' | 'jin' | 'taiwanJin';

export interface ParsedEntities {
  crop?: string;
  cropId?: string;
  area?: number;
  areaUnit?: AreaUnit;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  date?: Date;
  dateExpression?: string;
  condition?: string;
}

export interface ParsedIntent {
  action: IntentAction;
  entities: ParsedEntities;
  confidence: number;
  rawText: string;
}

// ============================================================
// Field Record Types
// ============================================================

export type FieldAction = 'planting' | 'growth' | 'harvest';

export interface FieldRecord {
  id: string;
  farmerId: string;
  cropId: string;
  action: FieldAction;
  areaSize?: number;
  quantity?: number;
  recordedAt: Date;
  predictedHarvestDate?: Date;
  actualHarvestDate?: Date;
  predictedYield?: number;
  actualYield?: number;
  notes?: string;
  images?: string[];
  createdAt: Date;
}

// ============================================================
// Prediction Types
// ============================================================

export interface HarvestPrediction {
  cropId: string;
  plantingDate: Date;
  predictions: {
    earliest: Date;
    likely: Date;
    latest: Date;
  };
  confidence: number;
  factors: {
    baseGrowthDays: number;
    temperatureAdjustment: number;
    rainfallAdjustment: number;
  };
}

export interface PriceTrend {
  cropId: string;
  current: number;
  weekAgo: number;
  monthAgo: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

// ============================================================
// User Types
// ============================================================

/**
 * User roles in the system.
 * - farmer: Agricultural producers
 * - cooperative_admin: Cooperative administrators with elevated permissions
 * - cooperative_staff: Regular cooperative staff
 * - customer: External buyers
 */
export type UserRole = 'farmer' | 'cooperative_admin' | 'cooperative_staff' | 'customer';

/**
 * Legacy role type for backward compatibility.
 * @deprecated Use UserRole instead
 */
export type LegacyUserRole = 'farmer' | 'cooperative' | 'customer';

export interface User {
  id: string;
  lineUserId: string;
  role: UserRole;
  cooperativeId: string;
  name?: string;
  locale?: 'en' | 'zh-TW';
  createdAt: Date;
}

// ============================================================
// Multi-Tenant Authorization Types
// ============================================================

/**
 * Permission actions that can be performed in the system.
 */
export type PermissionAction =
  // Record management
  | 'record:create'
  | 'record:read'
  | 'record:update'
  | 'record:delete'
  // Demand management
  | 'demand:create'
  | 'demand:read'
  | 'demand:update'
  | 'demand:delete'
  // Match management
  | 'match:create'
  | 'match:read'
  | 'match:update'
  | 'match:approve'
  | 'match:reject'
  // Member management
  | 'member:read'
  | 'member:invite'
  | 'member:update'
  | 'member:remove'
  // Report access
  | 'report:view'
  | 'report:export'
  // Cooperative settings
  | 'cooperative:read'
  | 'cooperative:update'
  | 'cooperative:manage_sharing';

/**
 * Resource scopes for permissions.
 */
export type PermissionScope =
  | 'own' // Only own resources
  | 'cooperative' // All resources in the cooperative
  | 'shared'; // Cross-cooperative shared resources

/**
 * Permission definition combining action and scope.
 */
export interface Permission {
  action: PermissionAction;
  scope: PermissionScope;
}

/**
 * Role permission matrix defining what each role can do.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  farmer: [
    // Farmers can manage their own records
    { action: 'record:create', scope: 'own' },
    { action: 'record:read', scope: 'own' },
    { action: 'record:update', scope: 'own' },
    { action: 'record:delete', scope: 'own' },
    // Farmers can view and respond to matches for their supply
    { action: 'match:read', scope: 'own' },
    { action: 'match:approve', scope: 'own' },
    { action: 'match:reject', scope: 'own' },
  ],
  cooperative_admin: [
    // Admins can manage all records in cooperative
    { action: 'record:create', scope: 'cooperative' },
    { action: 'record:read', scope: 'cooperative' },
    { action: 'record:update', scope: 'cooperative' },
    { action: 'record:delete', scope: 'cooperative' },
    // Admins can manage demands
    { action: 'demand:create', scope: 'cooperative' },
    { action: 'demand:read', scope: 'cooperative' },
    { action: 'demand:update', scope: 'cooperative' },
    { action: 'demand:delete', scope: 'cooperative' },
    // Admins can manage all matches
    { action: 'match:create', scope: 'cooperative' },
    { action: 'match:read', scope: 'cooperative' },
    { action: 'match:update', scope: 'cooperative' },
    { action: 'match:approve', scope: 'cooperative' },
    { action: 'match:reject', scope: 'cooperative' },
    // Admins can manage members
    { action: 'member:read', scope: 'cooperative' },
    { action: 'member:invite', scope: 'cooperative' },
    { action: 'member:update', scope: 'cooperative' },
    { action: 'member:remove', scope: 'cooperative' },
    // Admins have full report access
    { action: 'report:view', scope: 'cooperative' },
    { action: 'report:export', scope: 'cooperative' },
    // Admins can manage cooperative settings
    { action: 'cooperative:read', scope: 'cooperative' },
    { action: 'cooperative:update', scope: 'cooperative' },
    { action: 'cooperative:manage_sharing', scope: 'cooperative' },
  ],
  cooperative_staff: [
    // Staff can view all records in cooperative
    { action: 'record:read', scope: 'cooperative' },
    // Staff can manage demands
    { action: 'demand:create', scope: 'cooperative' },
    { action: 'demand:read', scope: 'cooperative' },
    { action: 'demand:update', scope: 'cooperative' },
    // Staff can view and create matches
    { action: 'match:create', scope: 'cooperative' },
    { action: 'match:read', scope: 'cooperative' },
    // Staff can view members
    { action: 'member:read', scope: 'cooperative' },
    // Staff can view reports
    { action: 'report:view', scope: 'cooperative' },
    { action: 'report:export', scope: 'cooperative' },
    // Staff can view cooperative info
    { action: 'cooperative:read', scope: 'cooperative' },
  ],
  customer: [
    // Customers can create and manage their own demands
    { action: 'demand:create', scope: 'own' },
    { action: 'demand:read', scope: 'own' },
    { action: 'demand:update', scope: 'own' },
    { action: 'demand:delete', scope: 'own' },
    // Customers can view matches for their demands
    { action: 'match:read', scope: 'own' },
  ],
};

/**
 * Tenant context for multi-tenant operations.
 * This context is injected into all service operations.
 */
export interface TenantContext {
  /** Current user ID */
  userId: string;
  /** Current user's role */
  role: UserRole;
  /** Cooperative ID (tenant identifier) */
  cooperativeId: string;
  /** User's locale preference */
  locale: 'en' | 'zh-TW';
}

/**
 * Extended context with resolved permissions.
 */
export interface AuthContext extends TenantContext {
  /** User's permissions based on role */
  permissions: Permission[];
  /** Whether user is a cooperative admin */
  isAdmin: boolean;
  /** Check if user has a specific permission */
  hasPermission: (action: PermissionAction, scope?: PermissionScope) => boolean;
}

/**
 * Data sharing configuration for cross-cooperative access.
 */
export interface DataSharingConfig {
  /** Cooperative ID that owns this config */
  cooperativeId: string;
  /** Whether to share aggregate supply data */
  shareSupplyData: boolean;
  /** Whether to allow receiving demands from other cooperatives */
  acceptExternalDemands: boolean;
  /** Specific cooperatives to share with (empty = share with all) */
  sharedWithCooperatives: string[];
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Cooperative onboarding request.
 */
export interface CooperativeOnboardingRequest {
  /** Cooperative name */
  name: string;
  /** Unique code (for member join) */
  code: string;
  /** Region */
  region: TaiwanRegion;
  /** Contact email */
  email?: string;
  /** Contact phone */
  phone?: string;
  /** Address */
  address?: string;
  /** Initial admin user's LINE ID */
  adminLineUserId: string;
  /** Initial admin user's name */
  adminName: string;
}

/**
 * Result of cooperative onboarding.
 */
export interface CooperativeOnboardingResult {
  /** Created cooperative ID */
  cooperativeId: string;
  /** Created admin user ID */
  adminUserId: string;
  /** Cooperative join code */
  joinCode: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Member invitation for joining a cooperative.
 */
export interface MemberInvitation {
  /** Invitation ID */
  id: string;
  /** Cooperative ID */
  cooperativeId: string;
  /** Inviter user ID */
  invitedBy: string;
  /** Invited role */
  role: UserRole;
  /** Invitation code (for manual entry) */
  code: string;
  /** Expiration date */
  expiresAt: Date;
  /** Whether invitation has been used */
  used: boolean;
  /** Created timestamp */
  createdAt: Date;
}

// ============================================================
// Cooperative Types
// ============================================================

/**
 * Summary of a single crop across all members.
 */
export interface CropSummary {
  cropId: string;
  cropName: string;
  totalArea: number;
  farmerCount: number;
  estimatedYield: number;
  estimatedHarvestDate: Date;
  confidence: number;
}

/**
 * Supply availability for a time period.
 */
export interface SupplyItem {
  cropId: string;
  cropName: string;
  estimatedQuantity: number;
  farmerCount: number;
  earliestDate: Date;
  latestDate: Date;
  farmers: Array<{
    farmerId: string;
    farmerName: string;
    quantity: number;
    harvestDate: Date;
  }>;
}

/**
 * Member crop report for a cooperative.
 */
export interface MemberCropReport {
  cooperativeId: string;
  generatedAt: Date;
  totalFarmers: number;
  totalArea: number;
  crops: CropSummary[];
}

/**
 * Supply availability report for a time period.
 */
export interface SupplyReport {
  cooperativeId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  items: SupplyItem[];
}

/**
 * Export format for reports.
 */
export type ExportFormat = 'xlsx' | 'csv' | 'json';

/**
 * Report type for export.
 */
export type ReportType = 'member_crops' | 'supply' | 'harvest_history';

// ============================================================
// Supply-Demand Matching Types
// ============================================================

/**
 * Status of a demand request.
 */
export type DemandStatus =
  | 'pending'
  | 'partially_matched'
  | 'matched'
  | 'fulfilled'
  | 'expired'
  | 'cancelled';

/**
 * Status of a match between supply and demand.
 */
export type MatchStatus =
  | 'suggested'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

/**
 * Priority level for demand requests.
 */
export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Buyer demand request for agricultural products.
 */
export interface DemandRequest {
  /** Unique identifier */
  id: string;
  /** Buyer/customer user ID */
  buyerId: string;
  /** Buyer name (denormalized for display) */
  buyerName?: string;
  /** Cooperative ID (if buyer is within cooperative network) */
  cooperativeId?: string;
  /** Requested crop ID */
  cropId: string;
  /** Crop name (denormalized for display) */
  cropName: string;
  /** Quantity needed in kg */
  quantity: number;
  /** Quantity already matched in kg */
  matchedQuantity: number;
  /** Minimum acceptable quality grade */
  minQualityGrade?: 'A' | 'B' | 'C' | 'D';
  /** Desired delivery date (earliest) */
  deliveryDateStart: Date;
  /** Desired delivery date (latest) */
  deliveryDateEnd: Date;
  /** Maximum price willing to pay (per kg) */
  maxPricePerKg?: number;
  /** Preferred region for sourcing */
  preferredRegion?: TaiwanRegion;
  /** Priority level */
  priority: DemandPriority;
  /** Current status */
  status: DemandStatus;
  /** Additional notes */
  notes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Expiration date for this demand */
  expiresAt?: Date;
}

/**
 * Score breakdown for a match.
 */
export interface MatchScore {
  /** Overall match score (0-100) */
  overall: number;
  /** Crop type compatibility (0-100) */
  cropMatch: number;
  /** Quantity compatibility (0-100) */
  quantityMatch: number;
  /** Delivery date compatibility (0-100) */
  dateMatch: number;
  /** Price compatibility (0-100, if applicable) */
  priceMatch?: number;
  /** Quality grade compatibility (0-100, if applicable) */
  qualityMatch?: number;
  /** Region preference match (0-100, if applicable) */
  regionMatch?: number;
}

/**
 * A match between supply and demand.
 */
export interface SupplyDemandMatch {
  /** Unique identifier */
  id: string;
  /** Demand request ID */
  demandId: string;
  /** Supply source - planting record ID */
  plantingRecordId: string;
  /** Farmer user ID */
  farmerId: string;
  /** Farmer name (denormalized) */
  farmerName?: string;
  /** Cooperative ID */
  cooperativeId: string;
  /** Crop ID */
  cropId: string;
  /** Crop name (denormalized) */
  cropName: string;
  /** Matched quantity in kg */
  quantity: number;
  /** Expected harvest date */
  expectedHarvestDate: Date;
  /** Proposed price per kg */
  proposedPricePerKg?: number;
  /** Expected quality grade */
  expectedQualityGrade?: 'A' | 'B' | 'C' | 'D';
  /** Match score breakdown */
  score: MatchScore;
  /** Current match status */
  status: MatchStatus;
  /** Farmer's response to match */
  farmerResponse?: {
    accepted: boolean;
    respondedAt: Date;
    notes?: string;
  };
  /** Buyer's confirmation */
  buyerConfirmation?: {
    confirmed: boolean;
    confirmedAt: Date;
    notes?: string;
  };
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Match suggestion for display to cooperatives.
 */
export interface MatchSuggestion {
  /** The demand being matched */
  demand: DemandRequest;
  /** Potential supply matches with scores */
  matches: Array<{
    plantingRecordId: string;
    farmerId: string;
    farmerName: string;
    availableQuantity: number;
    expectedHarvestDate: Date;
    expectedQualityGrade?: 'A' | 'B' | 'C' | 'D';
    score: MatchScore;
    region?: TaiwanRegion;
  }>;
  /** Total available quantity across all matches */
  totalAvailableQuantity: number;
  /** Whether demand can be fully satisfied */
  canFullyMatch: boolean;
}

/**
 * Summary of matching statistics for a cooperative.
 */
export interface MatchingSummary {
  /** Cooperative ID */
  cooperativeId: string;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Total demand requests in period */
  totalDemands: number;
  /** Pending demands */
  pendingDemands: number;
  /** Matched demands */
  matchedDemands: number;
  /** Fulfilled demands */
  fulfilledDemands: number;
  /** Total matches created */
  totalMatches: number;
  /** Accepted matches */
  acceptedMatches: number;
  /** Match success rate (accepted / total) */
  successRate: number;
  /** Total quantity matched in kg */
  totalQuantityMatched: number;
  /** Top matched crops */
  topCrops: Array<{
    cropId: string;
    cropName: string;
    matchCount: number;
    totalQuantity: number;
  }>;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Converts area to plots (分地)
 *
 * Conversion rates:
 * - 1 jia (甲) = 10 plots
 * - 1 hectare ≈ 10.31 plots
 * - 2934 ping (坪) = 10 plots
 */
export function convertToPlots(value: number, unit: AreaUnit): number {
  switch (unit) {
    case 'plot':
      return value;
    case 'jia':
      return value * 10;
    case 'ping':
      return value / 293.4;
    case 'hectare':
      return value * 10.31;
    default:
      return value;
  }
}

/**
 * Converts weight to kilograms
 *
 * Conversion rates:
 * - 1 jin (斤) = 0.5 kg
 * - 1 Taiwan jin (台斤) = 0.6 kg
 */
export function convertToKg(value: number, unit: QuantityUnit): number {
  switch (unit) {
    case 'kg':
      return value;
    case 'jin':
      return value * 0.5;
    case 'taiwanJin':
      return value * 0.6;
    default:
      return value;
  }
}

/**
 * Formats a date to MM/DD format
 */
export function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
