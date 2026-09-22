import { z } from 'zod';
export const featureIds = [
  'connector.x',
  'connector.rss',
  'connector.rest',
  'connector.webhook',
  'workflow.auto_air',
  'branding.custom',
  'output.obs',
] as const;
export type Feature = (typeof featureIds)[number];
export const statuses = [
  'UNINITIALIZED',
  'TRIAL_AVAILABLE',
  'TRIAL_ACTIVE',
  'LICENSE_ACTIVE',
  'OFFLINE_GRACE',
  'EXPIRING_SOON',
  'TRIAL_EXPIRED',
  'LICENSE_EXPIRED',
  'LICENSE_SUSPENDED',
  'LICENSE_REVOKED',
  'ACTIVATION_LIMIT_REACHED',
  'VALIDATION_ERROR',
] as const;
export const issues = [
  'configuration',
  'unavailable',
  'network',
  'clock',
  'invalidKey',
  'activationLimit',
  'deactivation',
  'policy',
  'validation',
  'busy',
] as const;
export const licenseSchema = z.object({
  status: z.enum(statuses),
  edition: z.enum(['Evaluation', 'Professional', 'Enterprise']).nullable(),
  features: z.array(z.enum(featureIds)).max(featureIds.length),
  expiresAt: z.number().positive().optional(),
  trialExpiresAt: z.number().positive().optional(),
  offlineGraceUntil: z.number().positive().optional(),
  lastValidatedAt: z.number().positive().optional(),
  validUntil: z.number().positive().optional(),
  activationId: z.string().max(128).optional(),
  activationCount: z.number().int().min(0).optional(),
  activationLimit: z.number().int().min(-1).optional(),
  issue: z.enum(issues).optional(),
  configured: z.boolean(),
  provider: z.enum(['cryptlex', 'test']),
  sdkVersion: z.string().max(40).optional(),
});
export type LicenseState = z.infer<typeof licenseSchema>;
export type LicenseAction = 'check' | 'refresh' | 'trial' | 'activate' | 'deactivate';
export const licenseRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('activate'), key: z.string().trim().min(1).max(256) }),
  z.object({ action: z.enum(['refresh', 'trial', 'deactivate']) }),
]);
export type LicenseRequest = z.infer<typeof licenseRequestSchema>;
export interface LicenseProvider {
  run(action: LicenseAction, key?: string): Promise<LicenseState>;
  close(): void;
}
export const denied = (issue?: LicenseState['issue']): LicenseState => ({
  status: issue ? 'VALIDATION_ERROR' : 'UNINITIALIZED',
  edition: null,
  features: [],
  configured: false,
  provider: 'cryptlex',
  issue,
});
export function eligible(s: LicenseState, now = Date.now()) {
  return (
    ['TRIAL_ACTIVE', 'LICENSE_ACTIVE', 'OFFLINE_GRACE', 'EXPIRING_SOON'].includes(s.status) &&
    !!s.validUntil &&
    s.validUntil > now
  );
}
export const contactIds = [
  'salesEmail',
  'salesWebsite',
  'supportEmail',
  'contactURL',
  'privacyURL',
  'termsURL',
] as const;
export type ContactId = (typeof contactIds)[number];
export type Contacts = Record<ContactId, string>;
