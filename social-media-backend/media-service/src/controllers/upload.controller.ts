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
import { logger } from '../utils/logger';

export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/v1/media/upload/presigned
   * Body: { filename, content_type, size_bytes }
   */
  async requestPresignedUpload(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await this.uploadService.requestPresignedUpload(userId, req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/v1/media/upload/confirm/:mediaId
   */
  async confirmUpload(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { mediaId } = req.params;
    const media = await this.uploadService.confirmUpload(mediaId, userId);
    res.status(200).json({
      success: true,
      data: media,
    });
  }

  /**
   * GET /api/v1/media/:mediaId/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { mediaId } = req.params;
    const media = await this.uploadService.getMediaStatus(mediaId, userId);
    res.status(200).json({
      success: true,
      data: media,
    });
  }

  /**
   * DELETE /api/v1/media/:mediaId
   */
  async deleteMedia(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { mediaId } = req.params;
    await this.uploadService.deleteMedia(mediaId, userId);
    res.status(200).json({ success: true, message: 'Media deleted' });
  }

  /**
   * GET /api/v1/media
   * Query: { limit?, offset? }
   */
  async listUserMedia(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const limit = parseInt(String(req.query.limit ?? 20), 10);
    const offset = parseInt(String(req.query.offset ?? 0), 10);
    const files = await this.uploadService.listUserMedia(userId, limit, offset);
    res.status(200).json({
      success: true,
      data: files,
      pagination: { limit, offset, count: files.length },
    });
  }
}
