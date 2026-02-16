/**
 * User E2E Tests
 * Complete end-to-end flow testing
 */

import request from 'supertest';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';

describe('User E2E Tests', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let secondUserId: string;

  beforeAll(async () => {
    // Setup test app
    process.env.NODE_ENV = 'test';
    const { default: createApp } = await import('../../src/index');
    // app = await createApp();

    // Create test user and get auth token
    // In real scenario, this would call auth-service
    authToken = 'test-jwt-token';
    testUserId = uuidv4();
    secondUserId = uuidv4();
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('Complete User Lifecycle', () => {
    it('should create, retrieve, update, and delete a user', async () => {
      // 1. Create user via auth service (simulated)
      const userData = {
        username: 'testuser_' + Date.now(),
        email: `test_${Date.now()}@example.com`,
        display_name: 'Test User',
        bio: 'Test bio',
      };

      // In real scenario, auth-service would create the user
      // and user-service would receive an event

      // 2. Get user profile
      const getResponse = await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data).toHaveProperty('id');
      expect(getResponse.body.data).toHaveProperty('username');

      // 3. Update user profile
      const updateResponse = await request(app)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: 'Updated Name',
          bio: 'Updated bio',
        })
        .expect(200);

      expect(updateResponse.body.data.display_name).toBe('Updated Name');
      expect(updateResponse.body.data.bio).toBe('Updated bio');

      // 4. Search for user
      const searchResponse = await request(app)
        .get('/api/v1/users/search')
        .query({ q: 'testuser' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(Array.isArray(searchResponse.body.data)).toBe(true);

      // 5. Delete user (soft delete)
      await request(app)
        .delete(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 6. Verify user is soft deleted
      await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Follower Flow', () => {
    it('should follow and unfollow users', async () => {
      // 1. Follow user
      const followResponse = await request(app)
        .post(`/api/v1/users/${secondUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(followResponse.body.success).toBe(true);

      // 2. Get followers list
      const followersResponse = await request(app)
        .get(`/api/v1/users/${secondUserId}/followers`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(followersResponse.body.data).toHaveLength(1);
      expect(followersResponse.body.data[0].follower_id).toBe(testUserId);

      // 3. Get following list
      const followingResponse = await request(app)
        .get(`/api/v1/users/${testUserId}/following`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(followingResponse.body.data).toHaveLength(1);
      expect(followingResponse.body.data[0].following_id).toBe(secondUserId);

      // 4. Check follow status
      const statusResponse = await request(app)
        .get(`/api/v1/users/${secondUserId}/follow-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.data.is_following).toBe(true);

      // 5. Unfollow user
      await request(app)
        .delete(`/api/v1/users/${secondUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 6. Verify unfollow
      const statusAfterResponse = await request(app)
        .get(`/api/v1/users/${secondUserId}/follow-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusAfterResponse.body.data.is_following).toBe(false);
    });

    it('should not allow following yourself', async () => {
      await request(app)
        .post(`/api/v1/users/${testUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should not allow duplicate follows', async () => {
      // Follow once
      await request(app)
        .post(`/api/v1/users/${secondUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to follow again
      await request(app)
        .post(`/api/v1/users/${secondUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);
    });
  });

  describe('GDPR Compliance', () => {
    it('should export user data', async () => {
      const exportResponse = await request(app)
        .post(`/api/v1/users/${testUserId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(exportResponse.body.success).toBe(true);
      expect(exportResponse.body.data).toHaveProperty('user');
      expect(exportResponse.body.data).toHaveProperty('followers');
      expect(exportResponse.body.data).toHaveProperty('following');
      expect(exportResponse.body.data).toHaveProperty('exportDate');
    });

    it('should request data deletion with grace period', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteResponse.body.data).toHaveProperty('gracePeriodDays');
      expect(deleteResponse.body.data.gracePeriodDays).toBe(30);
      expect(deleteResponse.body.data).toHaveProperty('deletionDate');
    });

    it('should cancel deletion during grace period', async () => {
      // Request deletion
      await request(app)
        .delete(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Cancel deletion
      const cancelResponse = await request(app)
        .post(`/api/v1/users/${testUserId}/cancel-deletion`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);

      // Verify user is active again
      const userResponse = await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(userResponse.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Caching', () => {
    it('should cache user profile', async () => {
      const firstResponse = await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const firstTime = parseInt(firstResponse.headers['x-response-time']);

      // Second request should be faster (cached)
      const secondResponse = await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondTime = parseInt(secondResponse.headers['x-response-time']);

      expect(secondTime).toBeLessThan(firstTime);
    });

    it('should invalidate cache on update', async () => {
      // Get user (cache it)
      await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Update user
      await request(app)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'New Name' })
        .expect(200);

      // Get user again (should fetch from DB)
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.display_name).toBe('New Name');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent user', async () => {
      await request(app)
        .get(`/api/v1/users/${uuidv4()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/v1/users/${testUserId}`)
        .expect(401);
    });

    it('should return 403 when updating other users', async () => {
      await request(app)
        .put(`/api/v1/users/${secondUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ display_name: 'Hacked' })
        .expect(403);
    });

    it('should validate input data', async () => {
      await request(app)
        .put(`/api/v1/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          display_name: '', // Empty name
          bio: 'a'.repeat(501), // Too long bio
        })
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive requests', async () => {
      const requests = [];

      // Make 101 requests (assuming limit is 100/15min)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .get(`/api/v1/users/${testUserId}`)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should paginate followers list', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/followers`)
        .query({ page: 1, pageSize: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('pageSize');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('hasMore');
    });

    it('should respect page size limits', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUserId}/followers`)
        .query({ pageSize: 1000 }) // Too large
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should be capped at max (e.g., 100)
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });
  });
});
