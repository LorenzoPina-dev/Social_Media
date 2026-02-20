/**
 * Unit tests — MediaProducer
 */

import { MediaProducer } from '../../src/kafka/producers/media.producer';

jest.mock('../../src/config/kafka', () => ({
  getKafkaProducer: jest.fn(),
}));

import { getKafkaProducer } from '../../src/config/kafka';

describe('MediaProducer', () => {
  let producer: MediaProducer;
  const mockSend = jest.fn().mockResolvedValue(undefined);
  const mockKafkaProducer = { send: mockSend };

  beforeEach(() => {
    jest.clearAllMocks();
    (getKafkaProducer as jest.Mock).mockReturnValue(mockKafkaProducer);
    producer = new MediaProducer();
  });

  it('should publish media_uploaded event', async () => {
    await producer.publishMediaUploaded({
      mediaId: 'media-1',
      userId: 'user-1',
      content_type: 'image/jpeg',
      size_bytes: 1000,
      storage_key: 'user-1/media-1/photo.jpg',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'media_events',
        messages: expect.arrayContaining([
          expect.objectContaining({
            key: 'media-1',
            value: expect.stringContaining('media_uploaded'),
          }),
        ]),
      })
    );
  });

  it('should publish media_processed event', async () => {
    await producer.publishMediaProcessed({
      mediaId: 'media-1',
      userId: 'user-1',
      cdn_url: 'https://cdn.example.com/photo.jpg',
      thumbnail_url: 'https://cdn.example.com/photo_thumb.jpg',
      blurhash: 'LGFFaXYk',
      width: 1920,
      height: 1080,
      duration_seconds: null,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'media_events' })
    );
    const payload = JSON.parse(mockSend.mock.calls[0][0].messages[0].value);
    expect(payload.type).toBe('media_processed');
    expect(payload.payload.cdn_url).toBe('https://cdn.example.com/photo.jpg');
  });

  it('should publish media_deleted event', async () => {
    await producer.publishMediaDeleted({ mediaId: 'media-1', userId: 'user-1' });

    const payload = JSON.parse(mockSend.mock.calls[0][0].messages[0].value);
    expect(payload.type).toBe('media_deleted');
    expect(payload.entityId).toBe('media-1');
  });

  it('should gracefully handle Kafka producer not available', async () => {
    (getKafkaProducer as jest.Mock).mockImplementation(() => { throw new Error('No kafka'); });
    producer = new MediaProducer();

    // Should not throw
    await expect(producer.publishMediaUploaded({
      mediaId: 'media-1',
      userId: 'user-1',
      content_type: 'image/jpeg',
      size_bytes: 500,
      storage_key: 'key',
    })).resolves.toBeUndefined();
  });
});
