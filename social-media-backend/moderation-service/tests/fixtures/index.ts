import { v4 as uuidv4 } from 'uuid';
import type { ModerationCase, ModerationDecision, Appeal } from '../../src/types';

// ─── Entity factories ────────────────────────────────────────────────────────

export const createModerationCaseFixture = (
  overrides: Partial<ModerationCase> = {},
): ModerationCase => ({
  id: uuidv4(),
  entity_id: uuidv4(),
  entity_type: 'POST',
  reason: 'AUTO_FLAGGED',
  status: 'PENDING',
  ml_score: 0.5,
  ml_categories: { toxicity: 0.5, spam: 0.1 },
  assigned_to: null,
  created_at: new Date(),
  resolved_at: null,
  ...overrides,
});

export const createDecisionFixture = (
  overrides: Partial<ModerationDecision> = {},
): ModerationDecision => ({
  id: uuidv4(),
  case_id: uuidv4(),
  decision: 'APPROVED',
  reason: null,
  decided_by: null,
  decided_at: new Date(),
  ...overrides,
});

export const createAppealFixture = (overrides: Partial<Appeal> = {}): Appeal => ({
  id: uuidv4(),
  case_id: uuidv4(),
  user_id: uuidv4(),
  reason: 'I believe this content was wrongly flagged.',
  status: 'PENDING',
  created_at: new Date(),
  resolved_at: null,
  ...overrides,
});

// ─── DTO factories ───────────────────────────────────────────────────────────

export const createReportDto = (overrides: Record<string, unknown> = {}) => ({
  entity_id: uuidv4(),
  entity_type: 'POST',
  reason: 'USER_REPORT',
  content: 'This is normal content',
  ...overrides,
});

export const createAppealDto = (overrides: Record<string, unknown> = {}) => ({
  case_id: uuidv4(),
  reason: 'I believe this content was wrongly flagged. It complies with all guidelines.',
  ...overrides,
});

// ─── JWT helper ──────────────────────────────────────────────────────────────

export const MOCK_USER_ID = uuidv4();
export const MOCK_ADMIN_ID = uuidv4();

export const VALID_TOKEN = 'Bearer mock-valid-token';
