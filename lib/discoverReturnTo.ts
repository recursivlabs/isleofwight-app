type SearchParams = Record<string, string | string[] | undefined>;

export function discoverReturnTo(pathname: string, params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first) query.set(key, first);
  }

  const suffix = query.toString();
  return `${pathname}${suffix ? `?${suffix}` : ''}`;
}
