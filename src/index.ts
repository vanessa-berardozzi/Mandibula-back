import dotenv from 'dotenv';
import app from './server';

// Load env variables
dotenv.config();

const PORT = process.env.PORT;

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏱️  Rate limiting: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'DISABLED (dev)'}`);
});

// Handle errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});