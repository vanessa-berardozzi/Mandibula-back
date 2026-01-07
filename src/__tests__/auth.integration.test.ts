import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock minimal de better-auth pour éviter l'import ESM en test
vi.mock('better-auth/node', () => ({
  toNodeHandler: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

// Mocks pour simuler le comportement d'auth (signup, signin, signout, session)
const users: any[] = [];
let currentSession: any = null;

const mockAuthHandler = (req: any, res: any, next: any) => {
  if (req.path.endsWith('/sign-up/email') && req.method === 'POST') {
    const { email, password } = req.body;
    if (users.find((u) => u.email === email)) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop faible' });
    }
    users.push({ email, password, role: 'user' });
    return res.status(201).json({ message: 'Inscription réussie' });
  }
  if (req.path.endsWith('/sign-in/email') && req.method === 'POST') {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    currentSession = { email: user.email, role: user.role };
    res.cookie('session', 'mocked');
    return res.status(200).json({ message: 'Connexion réussie' });
  }
  if (req.path.endsWith('/sign-out') && req.method === 'POST') {
    currentSession = null;
    res.clearCookie('session');
    return res.status(200).json({ message: 'Déconnexion réussie' });
  }
  if (req.path.endsWith('/session') && req.method === 'GET') {
    if (!currentSession) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.status(200).json({ user: currentSession });
  }
  return next();
};


// Setup test app (Express minimal, avec routes auth mockées)
const app = express();
app.use(express.json());
app.post('/api/auth/sign-up/email', mockAuthHandler);
app.post('/api/auth/sign-in/email', mockAuthHandler);
app.post('/api/auth/sign-out', mockAuthHandler);
app.get('/api/auth/session', mockAuthHandler);
app.get('/api/me', (req, res) => {
  // Simule un accès protégé : retourne un user factice si un cookie est présent
  if (req.headers.cookie === 'session=mocked' && currentSession) {
    return res.status(200).json({ user: { email: currentSession.email }, session: { token: 'mocked' } });
  }
  res.status(401).json({ error: 'Unauthorized' });
});
// Suppression de compte (DELETE /api/me)
app.delete('/api/me', (req, res) => {
  if (req.headers.cookie === 'session=mocked' && currentSession) {
    const idx = users.findIndex((u) => u.email === currentSession.email);
    if (idx !== -1) users.splice(idx, 1);
    currentSession = null;
    return res.status(200).json({ message: 'Compte supprimé avec succès' });
  }
  res.status(401).json({ error: 'Unauthorized' });
});
// Accès admin (GET /api/admin/dashboard)
app.get('/api/admin/dashboard', (req, res) => {
  if (req.headers.cookie === 'session=mocked' && currentSession) {
    if (currentSession.role === 'admin') {
      return res.status(200).json({ message: 'Bienvenue sur le dashboard admin', user: currentSession });
    }
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.status(401).json({ error: 'Unauthorized' });
});
  it('suppression de compte sans session → 401', async () => {
    const res = await request(app).delete('/api/me');
    expect(res.status).toBe(401);
  });

  it('suppression de compte avec session → 200', async () => {
    users.push({ email: 'delete@example.com', password: 'password123', role: 'user' });
    currentSession = { email: 'delete@example.com', role: 'user' };
    const res = await request(app)
      .delete('/api/me')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/supprimé/);
    expect(users.find((u) => u.email === 'delete@example.com')).toBeUndefined();
    expect(currentSession).toBeNull();
  });

  it('accès admin sans session → 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('accès admin sans rôle admin → 403', async () => {
    users.push({ email: 'user@example.com', password: 'password123', role: 'user' });
    currentSession = { email: 'user@example.com', role: 'user' };
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(403);
  });

  it('accès admin avec rôle admin → 200', async () => {
    users.push({ email: 'admin@example.com', password: 'password123', role: 'admin' });
    currentSession = { email: 'admin@example.com', role: 'admin' };
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.message).toMatch(/dashboard admin/);
  });

describe('Better Auth Integration Tests (mock)', () => {
  beforeEach(() => {
    users.length = 0;
    currentSession = null;
  });

  it('inscription réussie', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Inscription/);
  });

  it('inscription échoue si email déjà utilisé', async () => {
    users.push({ email: 'test@example.com', password: 'password123', role: 'user' });
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('inscription échoue si mot de passe faible', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .send({ email: 'weak@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('connexion réussie', async () => {
    users.push({ email: 'test@example.com', password: 'password123', role: 'user' });
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Connexion/);
  });

  it('connexion échoue si mauvais mot de passe', async () => {
    users.push({ email: 'test@example.com', password: 'password123', role: 'user' });
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('récupération de session valide', async () => {
    users.push({ email: 'test@example.com', password: 'password123', role: 'user' });
    currentSession = { email: 'test@example.com', role: 'user' };
    const res = await request(app)
      .get('/api/auth/session')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('récupération de session échoue sans session', async () => {
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(401);
  });

  it('déconnexion', async () => {
    currentSession = { email: 'test@example.com', role: 'user' };
    const res = await request(app)
      .post('/api/auth/sign-out')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Déconnexion/);
    expect(currentSession).toBeNull();
  });

  it('should return user when authenticated', async () => {
    users.push({ email: 'valid@example.com', password: 'password123', role: 'user' });
    currentSession = { email: 'valid@example.com', role: 'user' };
    const res = await request(app)
      .get('/api/me')
      .set('Cookie', 'session=mocked');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('valid@example.com');
  });

  it('should return 401 without session', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});