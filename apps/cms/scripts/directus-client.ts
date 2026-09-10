/**
 * Helper client for communicating with Directus CMS instance.
 */

export interface DirectusConfig {
  url: string;
  token?: string;
  email?: string;
  password?: string;
}

export function getDirectusConfig(): DirectusConfig {
  const url = process.env.DIRECTUS_URL || 'http://localhost:8055';
  const token =
    process.env.ADMIN_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    process.env.DIRECTUS_ADMIN_TOKEN ||
    'chrishop-admin-token';
  const email = process.env.ADMIN_EMAIL || 'admin@chrishop.com';
  const password = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

  return { url, token, email, password };
}

export async function getAuthHeader(config: DirectusConfig): Promise<Record<string, string>> {
  if (config.token) {
    try {
      const res = await fetch(`${config.url}/users/me`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      if (res.ok) {
        return { Authorization: `Bearer ${config.token}` };
      }
    } catch {
      // Continue to login fallback
    }
  }

  // Fallback to login
  if (config.email && config.password) {
    try {
      const loginRes = await fetch(`${config.url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.email, password: config.password }),
      });

      if (loginRes.ok) {
        const data = (await loginRes.json()) as { data?: { access_token?: string } };
        if (data.data?.access_token) {
          return { Authorization: `Bearer ${data.data.access_token}` };
        }
      }
    } catch {
      // Fallback
    }
  }

  return config.token ? { Authorization: `Bearer ${config.token}` } : {};
}

export async function directusFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any; errors?: any }> {
  const config = getDirectusConfig();
  const authHeaders = await getAuthHeader(config);

  const url = `${config.url}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }

  return {
    ok: res.ok,
    status: res.status,
    data: json?.data ?? json,
    errors: json?.errors,
  };
}
