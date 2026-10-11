import request from 'supertest';
import { createApp } from '../src/app';

describe('Server Health and Basic Routing Suite', () => {
  const app = createApp();

  describe('GET /api/v1/health', () => {
    it('should return 200 OK and valid health check schema', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('service', 'BandhanSetu API');
      expect(response.body.data).toHaveProperty('version', '1.0.0');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data.database).toHaveProperty('status');
      expect(['connected', 'disconnected', 'connecting', 'unconfigured']).toContain(
        response.body.data.database.status
      );
    });
  });

  describe('GET / (Root endpoint)', () => {
    it('should return service information', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'BandhanSetu Matrimonial API');
      expect(response.body).toHaveProperty('healthCheck', '/api/v1/health');
    });
  });

  describe('GET /api/v1/non-existent-route (404 Handling)', () => {
    it('should return structured 404 error response', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'ROUTE_NOT_FOUND');
    });
  });
});
