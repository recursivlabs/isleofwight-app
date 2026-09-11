// Minimal react-native stub for unit tests (web-path logic only).
export const Platform = {
  OS: 'web' as const,
  select: <T,>(spec: { web?: T; default?: T; ios?: T; android?: T; native?: T }): T | undefined =>
    spec.web ?? spec.default,
};

export default { Platform };
