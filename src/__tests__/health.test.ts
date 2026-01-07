import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Exemple d'app Express minimaliste pour test
const app = express();
app.get('/health', (_req, res) => res.json({ status: 'OK' }));

describe('GET /health', () => {
  it('should return status OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});
