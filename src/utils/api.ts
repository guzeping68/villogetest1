export const getApiUrl = (path: string) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (apiBase) return `${apiBase}${path}`;
  return path;
};
