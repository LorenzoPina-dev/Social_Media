/**
 * User Service Unit Tests
 */

import { UserService } from '../../../src/services/user.service';
import { UserModel } from '../../../src/models/user.model';
import { CacheService } from '../../../src/services/cache.service';
import { UserProducer } from '../../../src/kafka/producers/user.producer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';


// Mock dependencies
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/kafka/producers/user.producer');
jest.mock('../../../src/utils/logger');

describe('UserService', () => {
  let userService: UserService;
  let userModel: jest.Mocked<UserModel>;
  let cacheService: jest.Mocked<CacheService>;
  let userProducer: jest.Mocked<UserProducer>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    display_name: 'Test User',
    bio: 'Test bio',
    avatar_url: 'https://example.com/avatar.jpg',
    verified: false,
    follower_count: 0,
    following_count: 0,
    status: 'ACTIVE' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    userModel = new UserModel() as jest.Mocked<UserModel>;
    cacheService = new CacheService() as jest.Mocked<CacheService>;
    userProducer = new UserProducer() as jest.Mocked<UserProducer>;
    userService = new UserService(userModel, cacheService, userProducer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return cached user if available', async () => {
      cacheService.getUser.mockResolvedValue(mockUser);

      const result = await userService.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(cacheService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await userService.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(cacheService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(userModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(cacheService.setUser).toHaveBeenCalledWith(mockUser);
    });

    it('should return null if user not found', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findById.mockResolvedValue(null);

      const result = await userService.findById(mockUser.id);

      expect(result).toBeNull();
      expect(cacheService.setUser).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createData = {
      username: 'newuser',
      email: 'new@example.com',
      display_name: 'New User',
    };

    it('should create a new user successfully', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);
      userModel.create.mockResolvedValue(mockUser);

      const result = await userService.create(createData);

      expect(result).toEqual(mockUser);
      expect(userModel.findByUsername).toHaveBeenCalledWith(createData.username);
      expect(userModel.findByEmail).toHaveBeenCalledWith(createData.email);
      expect(userModel.create).toHaveBeenCalledWith(createData);
      expect(cacheService.setUser).toHaveBeenCalledWith(mockUser);
      expect(userProducer.publishUserCreated).toHaveBeenCalled();
    });

    it('should throw error if username already exists', async () => {
      userModel.findByUsername.mockResolvedValue(mockUser);

      await expect(userService.create(createData)).rejects.toThrow('Username already exists');
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(mockUser);

      await expect(userService.create(createData)).rejects.toThrow('Email already exists');
      expect(userModel.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateData = {
      display_name: 'Updated Name',
      bio: 'Updated bio',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateData };
      userModel.update.mockResolvedValue(updatedUser);

      const result = await userService.update(mockUser.id, updateData);

      expect(result).toEqual(updatedUser);
      expect(userModel.update).toHaveBeenCalledWith(mockUser.id, updateData);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(mockUser.id);
      expect(userProducer.publishUserUpdated).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete user successfully', async () => {
      await userService.softDelete(mockUser.id);

      expect(userModel.softDelete).toHaveBeenCalledWith(mockUser.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(mockUser.id);
      expect(userProducer.publishUserDeletionRequested).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    const searchQuery = 'test';
    const searchResults = [mockUser];

    it('should return cached results if available', async () => {
      const cacheKey = `search:${searchQuery}:{}`;
      cacheService.get.mockResolvedValue(JSON.stringify(searchResults));

      const result = await userService.search(searchQuery);

      expect(result).toEqual(searchResults);
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(userModel.search).not.toHaveBeenCalled();
    });

    it('should search database and cache results if not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      userModel.search.mockResolvedValue(searchResults);

      const result = await userService.search(searchQuery);

      expect(result).toEqual(searchResults);
      expect(userModel.search).toHaveBeenCalledWith(searchQuery, {});
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('findByIds', () => {
    const userIds = ['id1', 'id2', 'id3'];

    it('should return users from cache and database', async () => {
      const cachedUser = { ...mockUser, id: 'id1' };
      const dbUser1 = { ...mockUser, id: 'id2' };
      const dbUser2 = { ...mockUser, id: 'id3' };

      cacheService.getUser
        .mockResolvedValueOnce(cachedUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      userModel.findByIds.mockResolvedValue([dbUser1, dbUser2]);

      const result = await userService.findByIds(userIds);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual(cachedUser);
      expect(result).toContainEqual(dbUser1);
      expect(result).toContainEqual(dbUser2);
    });
  });
});
