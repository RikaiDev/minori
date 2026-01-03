/**
 * Supply-Demand Matching Module
 *
 * Exports for the matching system that connects farmer supply
 * with buyer demand.
 */

// Algorithm
export {
  calculateMatchScore,
  rankSupplyCandidates,
  canFullyMatch,
  selectOptimalSupply,
  DEFAULT_WEIGHTS,
  type SupplyCandidate,
  type MatchingWeights,
} from './matching-algorithm';

// Service
export {
  MatchingService,
  createMatchingService,
  type MatchingServiceConfig,
} from './matching-service';
