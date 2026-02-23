export interface Media {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  cdn_url?: string;
  thumbnail_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface PresignedUrlResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface MediaStatusResponse {
  id: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  cdn_url?: string;
  thumbnail_url?: string;
  error?: string;
}

export interface MediaListResponse {
  items: MediaStatusResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface UploadMediaRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
}