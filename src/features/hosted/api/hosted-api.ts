export type HostedUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

export type SellerPreset = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  print_profile_id: string;
  created_at: string;
  updated_at: string;
};

export type BillingPlanId = 'free' | 'maker';
export type BillingSubscriptionStatus =
  'free' | 'trialing' | 'active' | 'past_due' | 'scheduled_cancel' | 'expired';

export type EntitlementFlags = {
  presets: boolean;
  batch: boolean;
};

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year' | null;
  entitlements: EntitlementFlags;
};

export type BillingCatalog = {
  plans: BillingPlan[];
};

export type BillingStatus = {
  plan: BillingPlanId;
  status: BillingSubscriptionStatus;
  entitlements: EntitlementFlags;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingCheckoutRequest = {
  plan: BillingPlanId;
  returnUrl: string;
};

export type BillingPortalRequest = {
  returnUrl: string;
};

export type BillingRedirect = {
  url: string;
};

export type PresetInput = {
  name: string;
  params: Record<string, unknown>;
  printProfileId?: string;
};

export type PresetPatch = Partial<PresetInput>;

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const versionedApiPath = (path: string): string => `/api/v1${path}`;

export class HostedApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HostedApiError';
  }
}

const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new HostedApiError(
      body.error ?? `Hosted API request failed (${response.status}).`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

/** Reads the application session; Better Auth's mutation endpoints remain unversioned. */
export const currentUser = async (): Promise<HostedUser | undefined> => {
  try {
    return (
      (await apiRequest<{ user: HostedUser | null }>(versionedApiPath('/auth/session'))).user ??
      undefined
    );
  } catch (cause) {
    if (cause instanceof HostedApiError && cause.status === 401) return undefined;
    throw cause;
  }
};

export const signUp = (
  name: string,
  email: string,
  password: string,
): Promise<{ user: HostedUser }> =>
  apiRequest<{ user: HostedUser }>('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

export const signIn = (email: string, password: string): Promise<{ user: HostedUser }> =>
  apiRequest<{ user: HostedUser }>('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const signOut = async (): Promise<void> => {
  await apiRequest('/api/auth/sign-out', {
    method: 'POST',
    body: JSON.stringify({}),
  });
};

export const getBillingCatalog = (): Promise<BillingCatalog> =>
  apiRequest<BillingCatalog>(versionedApiPath('/billing/catalog'));

export const getBillingStatus = (): Promise<BillingStatus> =>
  apiRequest<BillingStatus>(versionedApiPath('/billing/status'));

export const createCheckout = (request: BillingCheckoutRequest): Promise<BillingRedirect> =>
  apiRequest<BillingRedirect>(versionedApiPath('/billing/checkout'), {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const createPortal = (request: BillingPortalRequest): Promise<BillingRedirect> =>
  apiRequest<BillingRedirect>(versionedApiPath('/billing/portal'), {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const listPresets = async (): Promise<SellerPreset[]> =>
  (await apiRequest<{ presets: SellerPreset[] }>(versionedApiPath('/presets'))).presets;

export function savePreset(input: PresetInput): Promise<{ preset: SellerPreset }>;
export function savePreset(
  name: string,
  params: Record<string, unknown>,
  printProfileId?: string,
): Promise<{ preset: SellerPreset }>;
export function savePreset(
  inputOrName: PresetInput | string,
  params?: Record<string, unknown>,
  printProfileId?: string,
): Promise<{ preset: SellerPreset }> {
  const input: PresetInput =
    typeof inputOrName === 'string'
      ? { name: inputOrName, params: params ?? {}, printProfileId }
      : inputOrName;
  return apiRequest<{ preset: SellerPreset }>(versionedApiPath('/presets'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export const updatePreset = (
  presetId: string,
  input: PresetPatch,
): Promise<{ preset: SellerPreset }> =>
  apiRequest<{ preset: SellerPreset }>(
    versionedApiPath(`/presets/${encodeURIComponent(presetId)}`),
    { method: 'PATCH', body: JSON.stringify(input) },
  );

export const deletePreset = async (presetId: string): Promise<void> => {
  await apiRequest(versionedApiPath(`/presets/${encodeURIComponent(presetId)}`), {
    method: 'DELETE',
  });
};
