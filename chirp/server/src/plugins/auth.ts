import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number };
    user: { sub: number };
  }
}

export const COOKIE = 'chirp_session';

export default fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: COOKIE, signed: false },
    sign: { expiresIn: '7d' },
  });
  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Not authenticated' });
    }
  });
});

export function setSession(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 7 * 24 * 3600,
  });
}

/** Viewer id if a valid session cookie is present, else undefined (for public routes). */
export async function optionalViewer(req: FastifyRequest): Promise<number | undefined> {
  try {
    await req.jwtVerify();
    return req.user.sub;
  } catch {
    return undefined;
  }
}
