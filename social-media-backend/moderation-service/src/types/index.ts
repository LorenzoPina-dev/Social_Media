export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  PostDto,
  UserDto,
} from '@social-media/shared';

// ────────────────────────────────────────────────────────────
// Entities (rispecchiano le tabelle del DB)
// ────────────────────────────────────────────────────────────

export type EntityType = 'POST' | 'COMMENT' | 'MEDIA';
export type CaseReason = 'AUTO_FLAGGED' | 'USER_REPORT' | 'ADMIN';
export type CaseStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
export type DecisionValue = 'APPROVED' | 'REJECTED' | 'ESCALATED';
export type AppealStatus = 'PENDING' | 'GRANTED' | 'DENIED';

export interface ModerationCase {
  id: string;
  entity_id: string;
  entity_type: EntityType;
  reason: CaseReason;
  status: CaseStatus;
  ml_score: number | null;
  ml_categories: Record<string, number> | null;
  assigned_to: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

export interface ModerationDecision {
  id: string;
  case_id: string;
  decision: DecisionValue;
  reason: string | null;
  decided_by: string | null; // null = automated
  decided_at: Date;
}

export interface Appeal {
  id: string;
  case_id: string;
  user_id: string;
  reason: string;
  status: AppealStatus;
  created_at: Date;
  resolved_at: Date | null;
}

// ────────────────────────────────────────────────────────────
// DTOs (input da HTTP)
// ────────────────────────────────────────────────────────────

export interface CreateModerationCaseDto {
  entity_id: string;
  entity_type: EntityType;
  reason: CaseReason;
  content?: string;
  media_urls?: string[];
}

export interface ResolveDecisionDto {
  decision: DecisionValue;
  reason?: string;
}

export interface AssignCaseDto {
  moderator_id: string;
}

export interface CreateAppealDto {
  case_id: string;
  reason: string;
}

export interface ResolveAppealDto {
  status: 'GRANTED' | 'DENIED';
}

// ────────────────────────────────────────────────────────────
// ML Analysis results
// ────────────────────────────────────────────────────────────

export interface TextAnalysisResult {
  score: number;
  categories: Record<string, number>;
}

export interface ImageAnalysisResult {
  safe: boolean;
  labels: string[];
  score: number;
}

// ────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(msg: string) {
    super(400, 'VALIDATION_ERROR', msg);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', msg);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(403, 'FORBIDDEN', msg);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, 'CONFLICT', msg);
  }
}

// ────────────────────────────────────────────────────────────
// Kafka Events
// ────────────────────────────────────────────────────────────

interface KafkaBaseEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
}

// Produced by moderation-service
export interface ContentFlaggedEvent extends KafkaBaseEvent {
  type: 'content_flagged';
  payload: {
    entityType: EntityType;
    mlScore: number;
    mlCategories: Record<string, number>;
    caseId: string;
  };
}

export interface ContentApprovedEvent extends KafkaBaseEvent {
  type: 'content_approved';
  payload: {
    entityType: EntityType;
    caseId: string;
    decidedBy: string | null;
  };
}

export interface ContentRejectedEvent extends KafkaBaseEvent {
  type: 'content_rejected';
  payload: {
    entityType: EntityType;
    caseId: string;
    decidedBy: string | null;
    reason: string | null;
  };
}

// Consumed from post_events
export interface PostCreatedEvent extends KafkaBaseEvent {
  type: 'post_created';
  payload: {
    content: string;
    hashtags: string[];
    visibility: string;
    media_urls?: string[];
  };
}

// ────────────────────────────────────────────────────────────
// JWT TokenPayload
// ────────────────────────────────────────────────────────────

// JWT auth types and `req.user` augmentation come from @social-media/shared.





