/**
 * Upload Controller — media-service
 *
 * POST /api/v1/media/upload/presigned   → requestPresignedUpload
 * POST /api/v1/media/upload/confirm/:id → confirmUpload
 * GET  /api/v1/media/:id/status         → getStatus
 * GET  /api/v1/media                    → listUserMedia
 * DELETE /api/v1/media/:id              → deleteMedia
 */

import { Request, Response } from 'express';
import { UploadService } from '../services/upload.service';
import { created, ok } from '@social-media/shared';

export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/v1/media/upload/presigned
   * Body: { filename, content_type, size_bytes }
   */
  async requestPresignedUpload(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await this.uploadService.requestPresignedUpload(userId, req.body);
    created(res, result);
  }

  /**
   * POST /api/v1/media/upload/confirm/:mediaId
   */
  async confirmUpload(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { mediaId } = req.params;
    const media = await this.uploadService.confirmUpload(mediaId, userId);
    ok(res, media);
  }

  /**
   * GET /api/v1/media/:mediaId/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { mediaId } = req.params;
    const media = await this.uploadService.getMediaStatus(mediaId, userId);
    ok(res, media);
  }

  /**
   * DELETE /api/v1/media/:mediaId
   */
  async deleteMedia(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { mediaId } = req.params;
    await this.uploadService.deleteMedia(mediaId, userId);
    ok(res, { deleted: true }, 'Media deleted');
  }

  /**
   * GET /api/v1/media
   * Query: { limit?, offset? }
   */
  async listUserMedia(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const limit = parseInt(String(req.query.limit ?? 20), 10);
    const offset = parseInt(String(req.query.offset ?? 0), 10);
    const files = await this.uploadService.listUserMedia(userId, limit, offset);
    ok(res, {
      items: files,
      pagination: { limit, offset, count: files.length },
    });
  }
}
