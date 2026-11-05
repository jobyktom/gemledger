/** Only allow redirects back into our own portal or admin pages. */
export function safeNext(next: string | null | undefined) {
  return next && /^\/(portal|admin)(\/|$)/.test(next) && !next.startsWith("//") ? next : "/portal";
}
