/**
 * MediaFile Model — media-service
 * Database operations for media_files table
 */

import { getDatabase } from '../config/database';
import { MediaFile, MediaStatus, VirusScanStatus } from '../types';
import { InternalError } from '../types';

export class MediaFileModel {
  private readonly table = 'media_files';

  async create(data: {
    id?: string;           // optional: caller may supply a pre-generated UUID
    user_id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    storage_key: string;
    status?: MediaStatus;
    virus_scan_status?: VirusScanStatus;
  }): Promise<MediaFile> {
    const db = getDatabase();

    const row = {
      ...(data.id ? { id: data.id } : {}),
      user_id: data.user_id,
      original_filename: data.original_filename,
      content_type: data.content_type,
      size_bytes: data.size_bytes,
      storage_key: data.storage_key,
      status: data.status ?? 'UPLOADING',
      virus_scan_status: data.virus_scan_status ?? 'PENDING',
      created_at: new Date(),
    };

    const [file] = await db(this.table).insert(row).returning('*');
    if (!file) throw new InternalError('Failed to create media file record');
    return file;
  }

  async findById(id: string): Promise<MediaFile | null> {
    const db = getDatabase();
    const file = await db(this.table)
      .where({ id })
      .whereNot({ status: 'DELETED' })
      .first();
    return file ?? null;
  }

  async findByUserId(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<MediaFile[]> {
    const db = getDatabase();
    return db(this.table)
      .where({ user_id: userId })
      .whereNot({ status: 'DELETED' })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  async updateStatus(id: string, status: MediaStatus): Promise<MediaFile> {
    const db = getDatabase();
    const [file] = await db(this.table)
      .where({ id })
      .update({
        status,
        ...(status === 'READY' || status === 'FAILED'
          ? { processed_at: new Date() }
          : {}),
      })
      .returning('*');
    if (!file) throw new InternalError(`MediaFile ${id} not found`);
    return file;
  }

  async updateProcessed(
    id: string,
    data: {
      status: MediaStatus;
      cdn_url?: string | null;
      thumbnail_url?: string | null;
      blurhash?: string | null;
      width?: number | null;
      height?: number | null;
      duration_seconds?: number | null;
      virus_scan_status?: VirusScanStatus;
    },
  ): Promise<MediaFile> {
    const db = getDatabase();
    const [file] = await db(this.table)
      .where({ id })
      .update({
        ...data,
        processed_at: new Date(),
      })
      .returning('*');
    if (!file) throw new InternalError(`MediaFile ${id} not found`);
    return file;
  }

  async softDelete(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ id }).update({ status: 'DELETED' });
  }

  async softDeleteByStorageKeys(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;
    const db = getDatabase();
    await db(this.table)
      .whereIn('storage_key', storageKeys)
      .update({ status: 'DELETED' });
  }

  async findByStorageKey(storageKey: string): Promise<MediaFile | null> {
    const db = getDatabase();
    const file = await db(this.table).where({ storage_key: storageKey }).first();
    return file ?? null;
  }
}
