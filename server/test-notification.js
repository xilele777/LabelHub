// Quick test to check if notification service loads correctly
try {
  const ns = require('./services/notificationService');
  console.log('notificationService loaded OK');
  console.log('exports:', Object.keys(ns));
  
  const auth = require('./middleware/auth');
  console.log('auth loaded OK');
  console.log('decodeToken:', typeof auth.decodeToken);
} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}
