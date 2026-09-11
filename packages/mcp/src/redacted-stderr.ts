const MAX_LOG_STRING_LENGTH = 1000;

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [redacted]')
    .replace(/(sk|rk|pk|ws|recursiv|minds)_[A-Za-z0-9._-]{12,}/g, '$1_[redacted]')
    .replace(/(github_pat|gh[opusr])_[A-Za-z0-9._-]{12,}/g, '$1_[redacted]')
    .replace(/([?&](?:token|api_key|apiKey|secret|key|code)=)[^&#\s]+/gi, '$1[redacted]')
    .slice(0, MAX_LOG_STRING_LENGTH);
}

function formatMcpLogValue(value: unknown): string {
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) return `[${value.name || 'Error'} redacted]`;
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value);
  return '[redacted object]';
}

export function writeMindsMcpStderr(...parts: unknown[]): void {
  const line = parts.length > 0
    ? parts.map(formatMcpLogValue).join(' ')
    : '[minds-mcp] [redacted]';
  process.stderr.write(`${line}\n`);
}
