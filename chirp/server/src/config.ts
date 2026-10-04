export const config = {
  port: Number(process.env.PORT ?? 3001),
  mysqlUrl: process.env.MYSQL_URL ?? 'mysql://chirp:chirppass@127.0.0.1:3306/chirp',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  rateMax: Number(process.env.RATE_MAX ?? 300),
  authRateMax: Number(process.env.AUTH_RATE_MAX ?? 10),
  isProd: process.env.NODE_ENV === 'production',
};
