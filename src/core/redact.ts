export function redact(value: string, secrets: string[] = []): string {
  let result = value;
  for (const secret of secrets) if (secret) result = result.split(secret).join('[REDACTED]');
  return result
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:license[_-]?key|api[_-]?key|token|password|secret|authorization)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,
      '$1[REDACTED]',
    )
    .replace(/https?:\/\/[^\s"']+/g, '[URL REDACTED]');
}
