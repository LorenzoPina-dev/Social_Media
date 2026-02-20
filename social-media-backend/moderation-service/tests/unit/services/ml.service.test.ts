import { MlService } from '../../../src/services/ml.service';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/metrics', () => ({
  mlAnalysisDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
}));
jest.mock('../../../src/config', () => ({
  config: {
    perspective: {
      apiKey: undefined,
      apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1',
    },
    aws: {
      accessKeyId: undefined,
      secretAccessKey: undefined,
      region: 'eu-west-1',
    },
    ml: {
      autoRejectThreshold: 0.8,
      autoApproveThreshold: 0.2,
    },
    logLevel: 'info',
    env: 'test',
  },
}));

describe('MlService', () => {
  let service: MlService;

  beforeEach(() => {
    service = new MlService();
    jest.clearAllMocks();
  });

  describe('analyzeText (rule-based fallback — no API key)', () => {
    it('should return score 0 for clean content', async () => {
      const result = await service.analyzeText('Hello world, nice post!');
      expect(result.score).toBe(0);
      expect(result.categories).toHaveProperty('toxicity');
    });

    it('should detect banned patterns and return non-zero score', async () => {
      const result = await service.analyzeText('I will kill you with hate');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should cap score at 0.5 in fallback mode', async () => {
      const result = await service.analyzeText(
        'kill kill kill kill kill spam hate threat kill',
      );
      expect(result.score).toBeLessThanOrEqual(0.5);
    });

    it('should return categories object with toxicity key', async () => {
      const result = await service.analyzeText('Test content');
      expect(result.categories).toHaveProperty('toxicity');
      expect(typeof result.categories.toxicity).toBe('number');
    });
  });

  describe('analyzeText (with Perspective API)', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
      (global as any).fetch = fetchMock;
    });

    it('should call Perspective API and parse response correctly', async () => {
      // Mock the config to have an API key
      const { config } = require('../../../src/config');
      (config as any).perspective = {
        apiKey: 'test-api-key',
        apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1',
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.3 } },
            SPAM: { summaryScore: { value: 0.05 } },
            INSULT: { summaryScore: { value: 0.1 } },
            THREAT: { summaryScore: { value: 0.02 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.01 } },
          },
        }),
      });

      const result = await service.analyzeText('Some content to analyze');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('comments:analyze?key=test-api-key'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.score).toBe(0.3);
      expect(result.categories.toxicity).toBe(0.3);
      expect(result.categories.spam).toBe(0.05);

      // Reset
      (config as any).perspective = { apiKey: undefined, apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1' };
    });

    it('should fall back to rule-based analysis when Perspective API fails', async () => {
      const { config } = require('../../../src/config');
      (config as any).perspective = { apiKey: 'test-key', apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1' };

      fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate limited' });

      const result = await service.analyzeText('Clean content');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('categories');

      (config as any).perspective = { apiKey: undefined, apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1' };
    });
  });

  describe('analyzeImage', () => {
    it('should return safe:true when AWS credentials are not configured', async () => {
      const result = await service.analyzeImage('http://example.com/image.jpg');
      expect(result.safe).toBe(true);
      expect(result.labels).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should handle image analysis errors gracefully', async () => {
      // Service should not throw even on errors
      const result = await service.analyzeImage('invalid-url');
      expect(result.safe).toBe(true);
    });
  });
});
