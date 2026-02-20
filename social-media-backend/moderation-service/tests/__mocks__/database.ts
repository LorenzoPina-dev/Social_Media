// Mock per src/config/database.ts
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  count: jest.fn().mockResolvedValue([{ count: '0' }]),
  select: jest.fn().mockReturnThis(),
};

const mockKnex = jest.fn().mockReturnValue(mockQuery);
(mockKnex as any).raw = jest.fn().mockResolvedValue([]);

jest.mock('../../src/config/database', () => ({
  getDatabase: jest.fn().mockReturnValue(mockKnex),
  connectDatabase: jest.fn().mockResolvedValue(mockKnex),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

export { mockKnex, mockQuery };
