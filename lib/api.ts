export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with '/': ${path}`);
  }

  return path;
}
