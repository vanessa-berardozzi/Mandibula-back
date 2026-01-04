import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import createError, { HttpError } from 'http-errors';
import { authLimiter, globalLimiter } from './middleware/rateLimiter';
import authRouter from './routes/auth';
import indexRouter from './routes/index';
import protectedRouter from './routes/protected';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Requis pour cookies Better Auth
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Rate limiting global (optionnel en dev)
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
}

// Better Auth handler avec validation Zod et rate limiting
app.use('/api/auth', authLimiter, authRouter);

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
