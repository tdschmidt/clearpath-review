import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ZodError } from 'zod';
import { offers, examples } from '../fixtures/examples.ts';
import { actionSchema, revisionSchema, submissionSchema } from './validation.ts';
import { WorkflowError, WorkflowStore } from './store.ts';
import { buildReviewExport } from './export.ts';
import type { Example } from './store.ts';
import type { Offer } from '../shared/types.ts';

export function createApp(options: { dataDir?: string; seedDemo?: boolean; offers?: Offer[]; examples?: Example[]; distDir?: string } = {}) {
  const store = new WorkflowStore(options.dataDir || process.env.DATA_DIR || './data', options.offers || offers, options.examples || examples);
  if (options.seedDemo ?? process.env.SEED_DEMO !== '0') store.seed();
  const app = express();
  app.disable('x-powered-by');
  app.locals.store = store;
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.header('Origin');
    let sameHost = !origin;
    try { if (origin) sameHost = ['http:', 'https:'].includes(new URL(origin).protocol) && new URL(origin).host === req.header('Host'); } catch { sameHost = false; }
    // TLS may terminate at a tunnel/proxy. Compare the visible host, not req.protocol.
    // This blocks browser cross-site writes; it is not authentication for the shared demo.
    if (!sameHost || req.header('Sec-Fetch-Site') === 'cross-site') return next(new WorkflowError(403, 'Use this workspace’s own page to make changes.', 'cross_site_request'));
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 3, fieldSize: 256 * 1024, parts: 14 } }).array('files', 10);
  const key = (req: express.Request) => {
    const value = req.header('Idempotency-Key');
    if (value && (!/^[\x21-\x7e]{1,160}$/.test(value))) throw new WorkflowError(400, 'Invalid retry key.');
    return value;
  };
  const payload = (req: express.Request) => {
    if (typeof req.body?.payload !== 'string') throw new WorkflowError(400, 'Provide the submission as a JSON payload field.');
    try { return JSON.parse(req.body.payload); } catch { throw new WorkflowError(400, 'The payload is not valid JSON.'); }
  };
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/offers', (_req, res) => res.json(store.offers));
  app.get('/api/cases', (_req, res) => res.json(store.list()));
  app.get('/api/cases/:id', (req, res) => res.json(store.get(req.params.id)));
  app.get('/api/cases/:id/export', (req, res) => {
    const archive = buildReviewExport(store.get(req.params.id), store.offers, store.assetsDir);
    res.attachment(archive.filename).type('application/zip').send(archive.bytes);
  });
  app.post('/api/cases', upload, (req, res) => res.status(201).json(store.submit(submissionSchema.parse(payload(req)), (req.files || []) as Express.Multer.File[], key(req))));
  app.post('/api/cases/:id/revisions', upload, (req, res) => {
    const input = payload(req);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WorkflowError(400, 'The revision payload must be an object.');
    if (req.body.expectedVersion !== undefined) {
      const expected = Number(req.body.expectedVersion);
      if (input.expectedVersion !== undefined && expected !== input.expectedVersion) throw new WorkflowError(400, 'Conflicting expected versions.');
      input.expectedVersion = expected;
    }
    res.json(store.revise(String(req.params.id), revisionSchema.parse(input), (req.files || []) as Express.Multer.File[], key(req)));
  });
  app.post('/api/cases/:id/actions', (req, res) => res.json(store.action(req.params.id, actionSchema.parse(req.body))));
  app.post('/api/examples/:key', (req, res) => res.status(201).json(store.freshExample(req.params.key)));
  app.get('/api/cases/:caseId/assets/:assetId', (req, res, next) => {
    const c = store.get(req.params.caseId);
    const asset = c.assets.find(item => item.id === req.params.assetId);
    if (!asset) throw new WorkflowError(404, 'This attachment was not found.', 'not_found');
    const path = join(store.assetsDir, asset.id);
    if (!existsSync(path)) throw new WorkflowError(404, 'Attachment bytes are unavailable. The case record has been preserved.', 'asset_unavailable');
    const inline = ['image/png', 'image/jpeg', 'application/pdf'].includes(asset.mime) && req.query.download !== '1';
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'self'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (inline) {
      res.attachment(asset.name);
      res.setHeader('Content-Disposition', String(res.getHeader('Content-Disposition')).replace(/^attachment/, 'inline'));
    } else res.attachment(asset.name);
    res.type(asset.mime);
    res.sendFile(path, error => { if (error) next(error); });
  });
  app.use('/api', (_req, _res, next) => next(new WorkflowError(404, 'This API route was not found.', 'not_found')));
  const dist = resolve(options.distDir || './dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res, next) => {
    if (existsSync(join(dist, 'index.html'))) res.sendFile(join(dist, 'index.html'));
    else next(new WorkflowError(404, 'Build the frontend or use the Vite development server.', 'frontend_unavailable'));
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const field = issue.path.join('.').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() || 'request';
      return res.status(400).json({ error: `Please check ${field}: ${issue.message}`, code: 'validation_error', details: error.issues.map(item => ({ field: item.path.join('.'), message: item.message })) });
    }
    if (error instanceof multer.MulterError) {
      const messages: Record<string, string> = {
        LIMIT_FILE_SIZE: 'Each attachment must be 10 MB or smaller.',
        LIMIT_FILE_COUNT: 'Upload no more than 10 attachments per submission.',
        LIMIT_FIELD_VALUE: 'A submission field is too long. Shorten it and try again.',
        LIMIT_UNEXPECTED_FILE: 'Upload no more than 10 attachments using the files field.',
      };
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: messages[error.code] || 'Too many submission fields or attachments.', code: error.code });
    }
    if (error instanceof WorkflowError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.currentVersion ? { currentVersion: error.currentVersion } : {}) });
    const e = error as { status?: number; type?: string };
    if (e.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large.' });
    if (e.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    console.error(error);
    return res.status(500).json({ error: 'The request could not be saved. Your existing case is unchanged.' });
  });
  return app;
}
