import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { ModerationDecision, DecisionValue, ResolveDecisionDto } from '../types';

const TABLE = 'moderation_decisions';

export class ModerationDecisionModel {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  async create(
    caseId: string,
    dto: ResolveDecisionDto,
    decidedBy: string | null,
  ): Promise<ModerationDecision> {
    const [row] = await this.db(TABLE)
      .insert({
        case_id: caseId,
        decision: dto.decision,
        reason: dto.reason ?? null,
        decided_by: decidedBy,
        decided_at: new Date(),
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findByCaseId(caseId: string): Promise<ModerationDecision[]> {
    const rows = await this.db(TABLE)
      .where({ case_id: caseId })
      .orderBy('decided_at', 'desc');
    return rows.map(this.mapRow);
  }

  async findLatestByCaseId(caseId: string): Promise<ModerationDecision | null> {
    const row = await this.db(TABLE)
      .where({ case_id: caseId })
      .orderBy('decided_at', 'desc')
      .first();
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: Record<string, unknown>): ModerationDecision {
    return {
      id: row.id as string,
      case_id: row.case_id as string,
      decision: row.decision as DecisionValue,
      reason: (row.reason as string) ?? null,
      decided_by: (row.decided_by as string) ?? null,
      decided_at: new Date(row.decided_at as string),
    };
  }
}

export const moderationDecisionModel = new ModerationDecisionModel();
