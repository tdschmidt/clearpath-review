import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Offer, OfferInput, Participant } from '../shared/types.ts';
import { PARTICIPANTS } from '../shared/types.ts';
import { inspectUpload, WorkflowError, type Upload } from './store.ts';

export function participant(actorId = 'maya'): Participant {
  const person = PARTICIPANTS.find(item => item.id === actorId);
  if (!person) throw new WorkflowError(400, 'Choose a demo participant.');
  return person;
}
export function listReferences(db: DatabaseSync): Offer[] {
  return db.prepare('SELECT data FROM offers ORDER BY created_at DESC, id ASC').all().map(row => JSON.parse(row.data as string));
}
export function createReference(db: DatabaseSync, assetsDir: string, input: OfferInput, files: Upload[], key?: string): Offer {
  const actor = participant(input.actorId);
  if (input.validTo < input.validFrom) throw new WorkflowError(400, 'The end date must be on or after the start date.');
  if (!files.length) throw new WorkflowError(400, 'Preserve at least one source document for this reference.');
  if (files.reduce((n, file) => n + file.buffer.length, 0) > 25 * 1024 * 1024) throw new WorkflowError(413, 'Reference files must total 25 MB or less.');
  if (input.supersedesId && !listReferences(db).some(offer => offer.id === input.supersedesId && offer.product === input.product)) throw new WorkflowError(400, 'The previous reference must be for the same product.');
  const assets = files.map(file => ({ id: randomUUID(), createdAt: new Date().toISOString(), ...inspectUpload(file) }));
  input.facts.forEach(fact => { if (fact.sourceFileIndex !== undefined && !assets[fact.sourceFileIndex]) throw new WorkflowError(400, 'A fact refers to a source file that was not uploaded.'); });
  const offer: Offer = {
    id: randomUUID(), product: input.product, name: input.name, version: input.version,
    validFrom: input.validFrom, validTo: input.validTo, disclosure: input.disclosure, source: input.source,
    assets, createdAt: new Date().toISOString(), createdBy: actor.name,
    ...(input.supersedesId ? { supersedesId: input.supersedesId } : {}),
    facts: input.facts.map(fact => ({ label: fact.label, value: fact.value,
      ...(fact.sourceFileIndex !== undefined ? { citation: { offerId: '', assetId: assets[fact.sourceFileIndex].id, ...(fact.page ? { page: fact.page } : {}) } } : {}),
    })),
  };
  offer.facts.forEach(fact => { if (fact.citation) fact.citation.offerId = offer.id; });
  const written: string[] = [];
  try {
    db.exec('BEGIN IMMEDIATE');
    const digest = createHash('sha256').update(JSON.stringify({ input, files: assets.map(({ name, sha256 }) => ({ name, sha256 })) })).digest('hex');
    if (key) {
      const prior = db.prepare("SELECT digest,response FROM requests WHERE scope='reference' AND key=?").get(key);
      if (prior) {
        if (prior.digest !== digest) throw new WorkflowError(409, 'This retry key was already used for different reference content.', 'idempotency_conflict');
        db.exec('COMMIT'); return JSON.parse(prior.response as string);
      }
    }
    if (listReferences(db).some(item => item.product === input.product && item.name === input.name && item.version === input.version)) throw new WorkflowError(409, 'This reference version already exists. Use a new version for changed facts.');
    assets.forEach((asset, i) => { const path = join(assetsDir, asset.id); writeFileSync(path, files[i].buffer, { flag: 'wx' }); written.push(path); });
    db.prepare('INSERT INTO offers(id,created_at,data) VALUES (?,?,?)').run(offer.id, offer.createdAt!, JSON.stringify(offer));
    if (key) db.prepare("INSERT INTO requests(scope,key,digest,response) VALUES ('reference',?,?,?)").run(key, digest, JSON.stringify(offer));
    db.exec('COMMIT');
    return offer;
  } catch (error) { db.exec('ROLLBACK'); written.forEach(path => rmSync(path, { force: true })); throw error; }
}
export function withdrawReference(db: DatabaseSync, offerId: string, reason: string, actorId?: string): Offer {
  participant(actorId);
  const offer = listReferences(db).find(item => item.id === offerId);
  if (!offer) throw new WorkflowError(404, 'This reference was not found.');
  if (offer.withdrawnAt) throw new WorkflowError(409, 'This reference has already been withdrawn.');
  offer.withdrawnAt = new Date().toISOString(); offer.withdrawalReason = reason;
  db.prepare('UPDATE offers SET data=? WHERE id=?').run(JSON.stringify(offer), offer.id);
  return offer;
}

// These three source files and their single-page fact citations were inspected
// when the authored examples were created. This is fixture import, not extraction.
export function importFixtureReferenceSources(db: DatabaseSync, assetsDir: string) {
  const sources: Record<string, string> = {
    'offer-personal-loan-v3': 'public/fixtures/offers/personal-loan.pdf',
    'offer-credit-card-v2': 'public/fixtures/offers/credit-card.pdf',
    'offer-mortgage-v1': 'public/fixtures/offers/mortgage.pdf',
  };
  for (const offer of listReferences(db)) {
    const source = sources[offer.id];
    if (!source || offer.assets?.length) continue;
    const bytes = readFileSync(source);
    const asset = { id: `reference-${offer.id}`, createdAt: '2026-09-01T00:00:00.000Z', ...inspectUpload({ originalname: source.split('/').at(-1)!, mimetype: 'application/pdf', buffer: bytes }) };
    const destination = join(assetsDir, asset.id);
    if (existsSync(destination)) {
      if (!readFileSync(destination).equals(bytes)) throw new WorkflowError(409, 'An authored reference original changed unexpectedly.');
    } else writeFileSync(destination, bytes, { flag: 'wx' });
    offer.assets = [asset];
    offer.facts = offer.facts.map(fact => ({ ...fact, citation: { offerId: offer.id, assetId: asset.id, page: 1 } }));
    db.prepare('UPDATE offers SET data=? WHERE id=?').run(JSON.stringify(offer), offer.id);
  }
}
