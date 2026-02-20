/**
 * Hashtag Service — estrazione e gestione hashtag
 */

import { HashtagModel } from '../models/hashtag.model';
import { Hashtag } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class HashtagService {
  constructor(private hashtagModel: HashtagModel) {}

  /**
   * Estrae gli hashtag da un testo con regex.
   * Lowercase, deduplica, max MAX_HASHTAGS per post.
   */
  extractFromContent(content: string): string[] {
    const regex = /#([a-zA-Z0-9_]+)/g;
    const matches = [...content.matchAll(regex)];
    const tags = matches
      .map((m) => m[1].toLowerCase())
      .filter((tag) => tag.length > 0 && tag.length <= 100);

    // Deduplica e limita
    const unique = [...new Set(tags)];
    return unique.slice(0, config.POST.MAX_HASHTAGS);
  }

  /**
   * Upsert hashtag e li collega al post.
   * Restituisce i tag estratti.
   */
  async processForPost(postId: string, content: string): Promise<string[]> {
    try {
      const tags = this.extractFromContent(content);
      if (tags.length === 0) return [];

      const hashtags = await this.hashtagModel.upsertMany(tags);
      const ids = hashtags.map((h) => h.id);
      await this.hashtagModel.linkToPost(postId, ids);
      return tags;
    } catch (error) {
      logger.error('Failed to process hashtags for post', { error, postId });
      throw error;
    }
  }

  /**
   * Rimuove i link del vecchio contenuto e processa i nuovi hashtag.
   */
  async reprocessForPost(postId: string, newContent: string): Promise<string[]> {
    try {
      await this.hashtagModel.decrementForPost(postId);
      await this.hashtagModel.unlinkFromPost(postId);
      return this.processForPost(postId, newContent);
    } catch (error) {
      logger.error('Failed to reprocess hashtags', { error, postId });
      throw error;
    }
  }

  /** Trending hashtag (con cache) */
  async getTrending(limit = 10): Promise<Hashtag[]> {
    return this.hashtagModel.getTrending(limit);
  }
}
