export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim(),
  );
}
