// Test configuration for Railway deployment
require('dotenv').config();

console.log('=== Fast Help Configuration Test ===');
console.log('Node Version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 3000);
console.log('Has Redis URL:', !!process.env.REDIS_URL);
console.log('Has JWT Secret:', !!process.env.JWT_SECRET);
console.log('Redis URL (masked):', process.env.REDIS_URL ? process.env.REDIS_URL.replace(/:[^:]*@/, ':***@') : 'NOT SET');

if (process.env.REDIS_URL) {
    console.log('✅ Redis URL is configured');
} else {
    console.log('❌ Redis URL is missing');
}

if (process.env.JWT_SECRET) {
    console.log('✅ JWT Secret is configured');
} else {
    console.log('❌ JWT Secret is missing');
}

console.log('=== Configuration test complete ===');
