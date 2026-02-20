import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { Appeal, AppealStatus, CreateAppealDto } from '../types';

const TABLE = 'appeals';

export class AppealModel {
  private db: Knex;

  constructor() {
    this.db = getDatabase();
  }

  async create(userId: string, dto: CreateAppealDto): Promise<Appeal> {
    const [row] = await this.db(TABLE)
      .insert({
        case_id: dto.case_id,
        user_id: userId,
        reason: dto.reason,
        status: 'PENDING',
        created_at: new Date(),
        resolved_at: null,
      })
      .returning('*');

    return this.mapRow(row);
  }

  async findById(id: string): Promise<Appeal | null> {
    const row = await this.db(TABLE).where({ id }).first();
    return row ? this.mapRow(row) : null;
  }

  async findByCaseId(caseId: string): Promise<Appeal[]> {
    const rows = await this.db(TABLE)
      .where({ case_id: caseId })
      .orderBy('created_at', 'desc');
    return rows.map(this.mapRow);
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<Appeal[]> {
    const rows = await this.db(TABLE)
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
    return rows.map(this.mapRow);
  }

  async findPending(limit = 20, offset = 0): Promise<Appeal[]> {
    const rows = await this.db(TABLE)
      .where({ status: 'PENDING' })
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset);
    return rows.map(this.mapRow);
  }

  async updateStatus(id: string, status: AppealStatus): Promise<Appeal | null> {
    const [row] = await this.db(TABLE)
      .where({ id })
      .update({
        status,
        resolved_at: status !== 'PENDING' ? new Date() : null,
      })
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  async existsForUserAndCase(userId: string, caseId: string): Promise<boolean> {
    const row = await this.db(TABLE)
      .where({ user_id: userId, case_id: caseId })
      .first();
    return !!row;
  }

  private mapRow(row: Record<string, unknown>): Appeal {
    return {
      id: row.id as string,
      case_id: row.case_id as string,
      user_id: row.user_id as string,
      reason: row.reason as string,
      status: row.status as AppealStatus,
      created_at: new Date(row.created_at as string),
      resolved_at: row.resolved_at ? new Date(row.resolved_at as string) : null,
    };
  }
}

export const appealModel = new AppealModel();
