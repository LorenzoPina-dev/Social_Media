import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import {
  ModerationCase,
  CaseStatus,
  CreateModerationCaseDto,
  EntityType,
} from '../types';

const TABLE = 'moderation_cases';

export class ModerationCaseModel {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  async create(
    dto: CreateModerationCaseDto & {
      ml_score?: number | null;
      ml_categories?: Record<string, number> | null;
      status?: CaseStatus;
    },
  ): Promise<ModerationCase> {
    const [row] = await this.db(TABLE)
      .insert({
        entity_id: dto.entity_id,
        entity_type: dto.entity_type,
        reason: dto.reason,
        status: dto.status ?? 'PENDING',
        ml_score: dto.ml_score ?? null,
        ml_categories: dto.ml_categories ? JSON.stringify(dto.ml_categories) : null,
        assigned_to: null,
        created_at: new Date(),
        resolved_at: null,
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findById(id: string): Promise<ModerationCase | null> {
    const row = await this.db(TABLE).where({ id }).first();
    return row ? this.mapRow(row) : null;
  }

  async findByEntityId(entityId: string, entityType?: EntityType): Promise<ModerationCase[]> {
    const query = this.db(TABLE).where({ entity_id: entityId });
    if (entityType) query.andWhere({ entity_type: entityType });
    const rows = await query.orderBy('created_at', 'desc');
    return rows.map(this.mapRow);
  }

  async findPending(limit = 20, offset = 0): Promise<ModerationCase[]> {
    const rows = await this.db(TABLE)
      .where({ status: 'PENDING' })
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset);
    return rows.map(this.mapRow);
  }

  async findByStatus(status: CaseStatus, limit = 20, offset = 0): Promise<ModerationCase[]> {
    const rows = await this.db(TABLE)
      .where({ status })
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset);
    return rows.map(this.mapRow);
  }

  async countByStatus(status: CaseStatus): Promise<number> {
    const [{ count }] = await this.db(TABLE).where({ status }).count('id as count');
    return Number(count);
  }

  async updateStatus(
    id: string,
    status: CaseStatus,
    resolvedAt?: Date,
  ): Promise<ModerationCase | null> {
    const [row] = await this.db(TABLE)
      .where({ id })
      .update({
        status,
        resolved_at: resolvedAt ?? null,
      })
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  async assignToModerator(id: string, moderatorId: string): Promise<ModerationCase | null> {
    const [row] = await this.db(TABLE)
      .where({ id })
      .update({
        assigned_to: moderatorId,
        status: 'IN_REVIEW',
      })
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: Record<string, unknown>): ModerationCase {
    return {
      id: row.id as string,
      entity_id: row.entity_id as string,
      entity_type: row.entity_type as EntityType,
      reason: row.reason as ModerationCase['reason'],
      status: row.status as CaseStatus,
      ml_score: row.ml_score != null ? Number(row.ml_score) : null,
      ml_categories:
        row.ml_categories != null
          ? typeof row.ml_categories === 'string'
            ? JSON.parse(row.ml_categories)
            : (row.ml_categories as Record<string, number>)
          : null,
      assigned_to: (row.assigned_to as string) ?? null,
      created_at: new Date(row.created_at as string),
      resolved_at: row.resolved_at ? new Date(row.resolved_at as string) : null,
    };
  }
}

export const moderationCaseModel = new ModerationCaseModel();
