import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import createError, { HttpError } from 'http-errors';
import authRouter from './routes/auth';
import indexRouter from './routes/index';
import protectedRouter from './routes/protected';

const app = express();

// Trust proxy pour récupérer la vraie IP (nécessaire pour rate limiting)
app.set('trust proxy', true);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration — supporte plusieurs origines via CORS_ORIGINS (CSV) ou CORS_ORIGIN (legacy)
const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Autoriser les requêtes sans origin (curl, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${origin}" non autorisée`));
    }
  },
  credentials: true, // Requis pour cookies Better Auth
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Middleware de redirection après OAuth vers le frontend
app.get('/', (req, res, next) => {
  // Si une session existe (cookie OAuth), rediriger vers le frontend home
  const sessionToken = req.cookies?.['better-auth.session_token'];
  if (sessionToken) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(frontendUrl);
  }
  next();
});

// Better Auth (avec rate limiting natif en base de données)
app.use('/api/auth', authRouter);

// Test route to verify auth is mounted
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// Routes
app.use('/', indexRouter);
app.use('/api', protectedRouter); // Routes protégées (/api/me, /api/admin/...)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {},
  });
});

export default app;
