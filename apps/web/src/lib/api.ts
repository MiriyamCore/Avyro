/** Browser calls same-origin `/api/*` (Next rewrites to the Nest API). */
export const API_BASE = '';

const ORG_STORAGE_KEY = 'ac-active-organization-id';

export function getActiveOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ORG_STORAGE_KEY);
}

export function setActiveOrganizationId(organizationId: string | null) {
  if (typeof window === 'undefined') return;
  if (organizationId) localStorage.setItem(ORG_STORAGE_KEY, organizationId);
  else localStorage.removeItem(ORG_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('ac:org-switched', { detail: organizationId }));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  const orgId = getActiveOrganizationId();
  if (orgId) headers.set('x-organization-id', orgId);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const errorBody = body as {
      error?: { message?: string; code?: string };
      message?: string;
    } | null;
    throw new ApiError(
      errorBody?.error?.message ??
        errorBody?.message ??
        `Request failed (${response.status})`,
      response.status,
      errorBody?.error?.code,
    );
  }

  return body as T;
}

export async function uploadReceipt(
  file: File,
  meta: { entityType?: string; entityId?: string; label?: string } = {},
) {
  const form = new FormData();
  form.append('file', file);
  if (meta.entityType) form.append('entityType', meta.entityType);
  if (meta.entityId) form.append('entityId', meta.entityId);
  if (meta.label) form.append('label', meta.label);
  return api('/api/v1/receipts', { method: 'POST', body: form });
}

export async function uploadLogo(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api<{ logoUrl: string | null; publicPath: string }>(
    '/api/v1/organizations/current/logo',
    { method: 'POST', body: form },
  );
}

export const ORG_LOGO_PATH = '/api/v1/organizations/current/logo';

export async function uploadPersonPhoto(personId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api<{ photoUrl: string | null; publicPath: string }>(
    `/api/v1/people/${personId}/photo`,
    { method: 'POST', body: form },
  );
}

export async function uploadPersonNid(personId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api<{ nidDocumentUrl: string | null; publicPath: string }>(
    `/api/v1/people/${personId}/nid`,
    { method: 'POST', body: form },
  );
}

export type ParsedBankStatementRow = {
  date: string;
  description: string;
  amount: string;
  balance?: string;
  externalId?: string;
  confidence: 'high' | 'medium' | 'low';
};

export type ParseBankStatementPdfResult = {
  rows: ParsedBankStatementRow[];
  pageCount: number;
  rawLineCount: number;
  warnings: string[];
  detectedFormat?: string;
};

export async function previewBankStatementPdf(bankAccountId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api<ParseBankStatementPdfResult>(
    `/api/v1/banking/accounts/${bankAccountId}/import/pdf/preview`,
    { method: 'POST', body: form },
  );
}

export function personPhotoPath(personId: string, bust = 0) {
  return `/api/v1/people/${personId}/photo?v=${bust}`;
}

export function personNidPath(personId: string, bust = 0) {
  return `/api/v1/people/${personId}/nid?v=${bust}`;
}
