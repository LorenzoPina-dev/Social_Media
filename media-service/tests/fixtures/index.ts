/**
 * Fixtures — media-service test data factories
 */

import { v4 as uuidv4 } from 'uuid';
import type { MediaFile, ProcessingJob } from '../../src/types';

export function createMediaFileFixture(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    id: uuidv4(),
    user_id: uuidv4(),
    original_filename: 'test-image.jpg',
    content_type: 'image/jpeg',
    size_bytes: 1024 * 100, // 100KB
    storage_key: `user-123/media-456/test-image.jpg`,
    cdn_url: 'http://localhost:9000/test-bucket/user-123/media-456/test-image.jpg',
    thumbnail_url: 'http://localhost:9000/test-bucket/user-123/media-456/test-image_thumb.jpg',
    blurhash: 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.',
    width: 1920,
    height: 1080,
    duration_seconds: null,
    status: 'READY',
    virus_scan_status: 'CLEAN',
    created_at: new Date('2025-01-01T00:00:00Z'),
    processed_at: new Date('2025-01-01T00:01:00Z'),
    ...overrides,
  };
}

export function createProcessingJobFixture(overrides: Partial<ProcessingJob> = {}): ProcessingJob {
  return {
    id: uuidv4(),
    media_id: uuidv4(),
    job_type: 'IMAGE_RESIZE',
    status: 'DONE',
    error_message: null,
    created_at: new Date('2025-01-01T00:00:00Z'),
    completed_at: new Date('2025-01-01T00:00:30Z'),
    ...overrides,
  };
}
