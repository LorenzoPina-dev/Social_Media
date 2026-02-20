import { getConsumer } from '../../config/kafka';
import { moderationService } from '../../services/moderation.service';
import { logger } from '../../utils/logger';
import { PostCreatedEvent } from '../../types';

const POST_EVENTS_TOPIC = 'post_events';
const ANALYSIS_DELAY_MS = 5000;

export async function startPostConsumer(): Promise<void> {
  const consumer = await getConsumer();

  await consumer.subscribe({ topic: POST_EVENTS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      let event: PostCreatedEvent;
      try {
        event = JSON.parse(rawValue) as PostCreatedEvent;
      } catch {
        logger.warn('Failed to parse Kafka message', { topic, partition });
        return;
      }

      if (event.type !== 'post_created') return;

      logger.info('Received post_created event', {
        entityId: event.entityId,
        userId: event.userId,
      });

      // Delay analysis to avoid race conditions with post-service DB writes
      setTimeout(() => {
        moderationService
          .analyzeContent(
            event.entityId,
            'POST',
            event.payload.content,
            event.payload.media_urls ?? [],
          )
          .catch((err) =>
            logger.error('Content analysis failed', {
              entityId: event.entityId,
              error: err,
            }),
          );
      }, ANALYSIS_DELAY_MS);
    },
  });

  logger.info('Post consumer started', { topic: POST_EVENTS_TOPIC });
}
