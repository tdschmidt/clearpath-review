import { z } from 'zod';

const text = (max = 2000) => z.string().trim().max(max);
const required = (max = 2000) => text(max).min(1);
const role = z.enum(['creative', 'destination', 'evidence', 'excluded']);
const destination = text(2000).refine(value => {
  if (!value) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Use a complete http or https URL, or leave the destination blank.');
const date = z.string().refine(value => {
  if (!value) return true;
  const parsed = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid YYYY-MM-DD date.');
const revisionFields = {
  submittedBy: required(120), summary: required(2000), offerId: text(120),
  intendedUse: text(3000), copy: text(60000), destinationUrl: destination,
  fileRoles: z.array(role).max(10),
};
export const submissionSchema = z.object({
  ...revisionFields, title: required(200), product: z.enum(['personal_loan', 'credit_card', 'mortgage']),
  summary: text(2000),
  submitter: required(120), submitterEmail: z.union([z.email().max(254), z.literal('')]),
  channel: required(120), launchDate: date,
}).strict();
export const revisionSchema = z.object({
  ...revisionFields,
  retainedComponents: z.array(z.object({ assetId: required(120), role }).strict()).max(100),
  expectedVersion: z.number().int().positive(),
}).strict();
const finding = z.object({
  kind: z.enum(['correction', 'evidence', 'question']), title: required(200),
  detail: required(5000), request: required(3000), location: text(300), assetId: text(120),
  owner: required(120), material: z.boolean(),
}).strict();
const version = { expectedVersion: z.number().int().positive() };
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ ...version, type: z.literal('confirm_intake') }).strict(),
  z.object({ ...version, type: z.literal('add_finding'), finding }).strict(),
  z.object({ ...version, type: z.literal('disposition'), findingId: required(120), status: z.enum(['open', 'resolved', 'dismissed']), reason: required(3000) }).strict(),
  z.object({ ...version, type: z.literal('set_waiting'), nextOwner: required(120), reason: required(2000) }).strict(),
  z.object({ ...version, type: z.literal('resume') }).strict(),
  z.object({ ...version, type: z.literal('add_note'), text: required(5000) }).strict(),
  z.object({ ...version, type: z.literal('decide'), outcome: z.enum(['approved', 'rejected']), scope: text(3000), rationale: required(5000), reviewed: z.boolean() }).strict(),
  z.object({ ...version, type: z.literal('save_draft'), subject: required(300), body: required(20000) }).strict(),
]);

export const offerSchema = z.object({
  product: z.enum(['personal_loan', 'credit_card', 'mortgage']), name: required(200), version: required(120),
  validFrom: date.refine(Boolean, 'A start date is required.'), validTo: date.refine(Boolean, 'An end date is required.'),
  source: required(3000), disclosure: text(10000), supersedesId: text(120).optional(), actorId: text(120).optional(),
  facts: z.array(z.object({ label: required(200), value: required(3000), sourceFileIndex: z.number().int().min(0).optional(), page: z.number().int().min(1).max(10000).optional() }).strict()).min(1).max(100),
}).strict();
export const withdrawalSchema = z.object({ reason: required(3000), actorId: text(120).optional() }).strict();
