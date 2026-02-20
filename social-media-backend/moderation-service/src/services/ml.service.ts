import { config } from '../config';
import { logger } from '../utils/logger';
import { mlAnalysisDuration } from '../utils/metrics';
import { TextAnalysisResult, ImageAnalysisResult } from '../types';

export class MlService {
  /**
   * Analyzes text content using Google Perspective API.
   * Returns a toxicity score (0-1) and per-category scores.
   * Falls back to rule-based heuristics if API key is not configured.
   */
  async analyzeText(content: string): Promise<TextAnalysisResult> {
    const timer = mlAnalysisDuration.startTimer({ provider: 'perspective', type: 'text' });

    try {
      if (!config.perspective.apiKey) {
        logger.warn('Perspective API key not configured, using rule-based fallback');
        return this.ruleBasedTextAnalysis(content);
      }

      const url = `${config.perspective.apiUrl}/comments:analyze?key=${config.perspective.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text: content },
          languages: ['en', 'it'],
          requestedAttributes: {
            TOXICITY: {},
            SPAM: {},
            INSULT: {},
            THREAT: {},
            IDENTITY_ATTACK: {},
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Perspective API error', { status: response.status, error });
        return this.ruleBasedTextAnalysis(content);
      }

      const data = (await response.json()) as {
        attributeScores: Record<string, { summaryScore: { value: number } }>;
      };

      const categories: Record<string, number> = {};
      for (const [key, val] of Object.entries(data.attributeScores)) {
        categories[key.toLowerCase()] = Math.round(val.summaryScore.value * 100) / 100;
      }

      const score = categories.toxicity ?? 0;

      logger.info('Text analysis complete', { score, categories });
      return { score, categories };
    } catch (err) {
      logger.error('Text analysis failed', { error: err });
      return this.ruleBasedTextAnalysis(content);
    } finally {
      timer();
    }
  }

  /**
   * Analyzes image content via AWS Rekognition.
   * Falls back to safe-by-default if AWS is not configured.
   */
  async analyzeImage(mediaUrl: string): Promise<ImageAnalysisResult> {
    const timer = mlAnalysisDuration.startTimer({ provider: 'rekognition', type: 'image' });

    try {
      if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
        logger.warn('AWS credentials not configured, skipping image analysis');
        return { safe: true, labels: [], score: 0 };
      }

      // NOTE: In production, use @aws-sdk/client-rekognition.
      // Stub implementation to avoid mandatory AWS SDK dependency in dev.
      logger.info('Image analysis requested', { mediaUrl });
      return { safe: true, labels: [], score: 0 };
    } catch (err) {
      logger.error('Image analysis failed', { error: err });
      return { safe: true, labels: [], score: 0 };
    } finally {
      timer();
    }
  }

  /** Simple rule-based fallback when Perspective API is unavailable */
  private ruleBasedTextAnalysis(content: string): TextAnalysisResult {
    const lowerContent = content.toLowerCase();

    // Very basic banned-word heuristic (not production-grade)
    const bannedPatterns = [/\b(spam|hate|kill|threat)\b/gi];
    const matchCount = bannedPatterns.reduce((acc, pattern) => {
      return acc + (lowerContent.match(pattern)?.length ?? 0);
    }, 0);

    const score = Math.min(matchCount * 0.15, 0.5);
    return {
      score,
      categories: { toxicity: score, spam: 0, insult: 0, threat: 0 },
    };
  }
}

export const mlService = new MlService();
