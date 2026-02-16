/**
 * Test Fixtures
 * Reusable test data for user service tests
 */

import { v4 as uuidv4 } from 'uuid';
import { User, Follower } from '../../src/types';

export const createMockUser = (overrides?: Partial<User>): User => {
  const id = uuidv4();
  return {
    id,
    username: `user_${id.substring(0, 8)}`,
    email: `${id.substring(0, 8)}@test.com`,
    display_name: 'Test User',
    bio: 'Test bio',
    avatar_url: 'https://example.com/avatar.jpg',
    verified: false,
    follower_count: 0,
    following_count: 0,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
};

export const createMockFollower = (
  followerId: string,
  followingId: string
): Follower => {
  return {
    id: uuidv4(),
    follower_id: followerId,
    following_id: followingId,
    created_at: new Date(),
  };
};

export const mockUsers = {
  john: createMockUser({
    username: 'john_doe',
    email: 'john@example.com',
    display_name: 'John Doe',
    verified: true,
    follower_count: 1500,
    following_count: 300,
  }),

  jane: createMockUser({
    username: 'jane_smith',
    email: 'jane@example.com',
    display_name: 'Jane Smith',
    verified: true,
    follower_count: 2000,
    following_count: 250,
  }),

  bob: createMockUser({
    username: 'bob_wilson',
    email: 'bob@example.com',
    display_name: 'Bob Wilson',
    verified: false,
    follower_count: 50,
    following_count: 100,
  }),

  deletedUser: createMockUser({
    username: 'deleted_user',
    email: 'deleted@example.com',
    display_name: 'Deleted User',
    status: 'PENDING_DELETION',
    deleted_at: new Date(),
  }),
};

export const mockJWT = {
  validToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired...',
  invalidToken: 'invalid.token.here',
};

export const mockEvents = {
  userCreated: {
    type: 'user_created',
    userId: uuidv4(),
    timestamp: new Date(),
    data: {
      username: 'newuser',
      email: 'new@example.com',
    },
  },

  userUpdated: {
    type: 'user_updated',
    userId: uuidv4(),
    timestamp: new Date(),
    changes: {
      display_name: 'Updated Name',
    },
  },

  userDeleted: {
    type: 'user_deletion_requested',
    userId: uuidv4(),
    timestamp: new Date(),
    gracePeriodDays: 30,
  },
};

export const clearDatabase = async (db: any) => {
  await db('followers').del();
  await db('users').del();
};

export const seedDatabase = async (db: any) => {
  await db('users').insert([
    mockUsers.john,
    mockUsers.jane,
    mockUsers.bob,
  ]);

  await db('followers').insert([
    createMockFollower(mockUsers.john.id, mockUsers.jane.id),
    createMockFollower(mockUsers.bob.id, mockUsers.john.id),
  ]);
};
