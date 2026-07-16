jest.mock('../utils/db', () => ({ getDatabase: jest.fn() }));

const { getDatabase } = require('../utils/db');
const { createRateLimitMiddleware } = require('../middleware/rateLimit');

function response() {
  return {
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

describe('MongoDB rate limiter', () => {
  test('uses an opaque, atomic counter and rejects requests over the limit', async () => {
    const findOneAndUpdate = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    getDatabase.mockReturnValue({ collection: () => ({ findOneAndUpdate }) });
    const limiter = createRateLimitMiddleware({ namespace: 'test', max: 1, windowMs: 60_000 });
    const request = { ip: '203.0.113.5', get: () => undefined };

    const allowedResponse = response();
    const next = jest.fn();
    await limiter(request, allowedResponse, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate.mock.calls[0][0]._id).not.toContain('203.0.113.5');
    expect(findOneAndUpdate.mock.calls[0][1].$inc).toEqual({ count: 1 });

    const blockedResponse = response();
    await limiter(request, blockedResponse, jest.fn());
    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.payload.error).toBe('Too Many Requests');
  });
});
