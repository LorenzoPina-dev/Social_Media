/**
 * Unit Tests — HashtagService
 */

import { HashtagService } from '../../../src/services/hashtag.service';
import { HashtagModel } from '../../../src/models/hashtag.model';
import { createMockHashtag } from '../../fixtures';

jest.mock('../../../src/models/hashtag.model');

const MockHashtagModel = HashtagModel as jest.MockedClass<typeof HashtagModel>;

describe('HashtagService', () => {
  let hashtagService: HashtagService;
  let hashtagModel: jest.Mocked<HashtagModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    hashtagModel = new MockHashtagModel() as jest.Mocked<HashtagModel>;
    hashtagService = new HashtagService(hashtagModel);
  });

  describe('extractFromContent', () => {
    it('should extract #hashtag from content', () => {
      const tags = hashtagService.extractFromContent('Post with #hello and #world');
      expect(tags).toContain('hello');
      expect(tags).toContain('world');
    });

    it('should lowercase all hashtags', () => {
      const tags = hashtagService.extractFromContent('#Hello #WORLD #CamelCase');
      expect(tags).toEqual(['hello', 'world', 'camelcase']);
    });

    it('should deduplicate hashtags', () => {
      const tags = hashtagService.extractFromContent('#tag #tag #TAG');
      expect(tags).toEqual(['tag']);
    });

    it('should return empty array if no hashtags', () => {
      const tags = hashtagService.extractFromContent('No hashtags here');
      expect(tags).toHaveLength(0);
    });

    it('should limit to MAX_HASHTAGS (30)', () => {
      const content = Array.from({ length: 35 }, (_, i) => `#tag${i}`).join(' ');
      const tags = hashtagService.extractFromContent(content);
      expect(tags.length).toBeLessThanOrEqual(30);
    });

    it('should handle underscore in hashtags', () => {
      const tags = hashtagService.extractFromContent('#some_tag');
      expect(tags).toContain('some_tag');
    });
  });

  describe('processForPost', () => {
    it('should call upsertMany and linkToPost with correct tags', async () => {
      const mockHashtag = createMockHashtag({ tag: 'hello' });
      hashtagModel.upsertMany.mockResolvedValue([mockHashtag]);
      hashtagModel.linkToPost.mockResolvedValue(undefined);

      const tags = await hashtagService.processForPost('post-id', 'Post with #hello');

      expect(hashtagModel.upsertMany).toHaveBeenCalledWith(['hello']);
      expect(hashtagModel.linkToPost).toHaveBeenCalledWith('post-id', [mockHashtag.id]);
      expect(tags).toEqual(['hello']);
    });

    it('should return empty array and not call upsert for content without hashtags', async () => {
      const tags = await hashtagService.processForPost('post-id', 'No tags here');
      expect(hashtagModel.upsertMany).not.toHaveBeenCalled();
      expect(tags).toHaveLength(0);
    });
  });

  describe('reprocessForPost', () => {
    it('should decrement old hashtags and process new ones', async () => {
      hashtagModel.decrementForPost.mockResolvedValue(undefined);
      hashtagModel.unlinkFromPost.mockResolvedValue(undefined);
      hashtagModel.upsertMany.mockResolvedValue([]);
      hashtagModel.linkToPost.mockResolvedValue(undefined);

      await hashtagService.reprocessForPost('post-id', 'New #content');

      expect(hashtagModel.decrementForPost).toHaveBeenCalledWith('post-id');
      expect(hashtagModel.unlinkFromPost).toHaveBeenCalledWith('post-id');
    });
  });

  describe('getTrending', () => {
    it('should return trending hashtags from model', async () => {
      const trending = [createMockHashtag({ post_count: 100 }), createMockHashtag({ post_count: 50 })];
      hashtagModel.getTrending.mockResolvedValue(trending);

      const result = await hashtagService.getTrending(10);

      expect(hashtagModel.getTrending).toHaveBeenCalledWith(10);
      expect(result).toEqual(trending);
    });
  });
});
