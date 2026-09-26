import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';

import type { KeychainParams } from '@/entities/keychain/model/types';

import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import {
  currentUser,
  createCheckout,
  createPortal,
  deletePreset,
  getBillingCatalog,
  getBillingStatus,
  listPresets,
  savePreset as createPreset,
  signIn,
  signOut,
  signUp,
  type HostedUser,
  type BillingCatalog,
  type BillingStatus,
  type SellerPreset,
} from '../api/hosted-api';
import { hostedMode } from '../config';
import {
  DEFAULT_PRESET_PRINT_PROFILE_ID,
  paramsForPresetOrder,
  presetParamsForStorage,
  type SellerPresetParams,
} from '../model/seller-preset';

export type HostedAccountState = {
  account: HostedUser | undefined;
  presets: SellerPreset[];
  loading: boolean;
  loadError: string | undefined;
  accountOpen: boolean;
  setAccountOpen: (open: boolean) => void;
  authMode: 'sign-in' | 'sign-up';
  setAuthMode: (mode: 'sign-in' | 'sign-up') => void;
  authName: string;
  setAuthName: (name: string) => void;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authPassword: string;
  setAuthPassword: (password: string) => void;
  authBusy: boolean;
  authError: string | undefined;
  saveBusy: boolean;
  saveError: string | undefined;
  deletingId: string | undefined;
  deleteError: string | undefined;
  refresh: () => Promise<void>;
  submitAuth: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  savePreset: (name: string, params?: KeychainParams) => Promise<boolean>;
  saveCurrentPreset: () => Promise<void>;
  loadPreset: (preset: SellerPreset) => void;
  removePreset: (preset: SellerPreset) => Promise<void>;
  logOut: () => Promise<void>;
  billingCatalog: BillingCatalog | undefined;
  billingStatus: BillingStatus;
  billingError: string | undefined;
  billingBusy: boolean;
  retryBilling: () => Promise<void>;
  startCheckout: (interval: 'month' | 'year') => Promise<void>;
  openPortal: () => Promise<void>;
  billingActionError: string | undefined;
};

const FREE_BILLING_STATUS: BillingStatus = {
  plan: 'free',
  status: 'free',
  entitlements: { presets: false, batch: false },
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export const useHostedAccount = (
  params: KeychainParams,
  onLoadPreset: (params: KeychainParams) => void,
  locale: Locale = 'en',
): HostedAccountState => {
  const [account, setAccount] = useState<HostedUser>();
  const [presets, setPresets] = useState<SellerPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [billingCatalog, setBillingCatalog] = useState<BillingCatalog>();
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(FREE_BILLING_STATUS);
  const [billingError, setBillingError] = useState<string>();
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingActionError, setBillingActionError] = useState<string>();
  const authEpoch = useRef(0);
  const { track } = useAnalytics();

  const refresh = useCallback(async (): Promise<void> => {
    if (!hostedMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    const epoch = authEpoch.current;
    try {
      const user = await currentUser();
      if (epoch !== authEpoch.current) return;

      const nextPresets = user ? await listPresets() : [];
      if (epoch !== authEpoch.current) return;
      setAccount(user);
      setPresets(nextPresets);
      if (user) {
        try {
          const [catalog, status] = await Promise.all([getBillingCatalog(), getBillingStatus()]);
          if (epoch !== authEpoch.current) return;
          setBillingCatalog(catalog);
          setBillingStatus(status);
          setBillingError(undefined);
        } catch {
          setBillingStatus(FREE_BILLING_STATUS);
          setBillingError(
            'Billing is temporarily unavailable. The free customizer remains available.',
          );
        }
      }
    } catch {
      setLoadError('We could not load your workspace. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const retryBilling = useCallback(async (): Promise<void> => {
    if (!account) return;
    setBillingBusy(true);
    try {
      const refreshedAccount = await currentUser();
      if (!refreshedAccount) {
        setAccount(undefined);
        setPresets([]);
        setBillingStatus(FREE_BILLING_STATUS);
        return;
      }
      setAccount(refreshedAccount);
      const [catalog, status] = await Promise.all([getBillingCatalog(), getBillingStatus()]);

      setBillingCatalog(catalog);
      setBillingStatus(status);
      setBillingError(undefined);
    } catch {
      setBillingCatalog(undefined);
      setBillingStatus(FREE_BILLING_STATUS);
      setBillingError('Billing is temporarily unavailable. The free customizer remains available.');
    } finally {
      setBillingBusy(false);
    }
  }, [account]);

  const startCheckout = async (interval: 'month' | 'year'): Promise<void> => {
    setBillingActionError(undefined);

    if (account?.emailVerified !== true) {
      setBillingActionError(t(locale, 'billingVerifyCheckout'));
      return;
    }

    try {
      const { url } = await createCheckout({
        plan: 'maker',
        interval,
        returnUrl: window.location.href,
      });

      window.location.assign(url);
    } catch {
      setBillingActionError(t(locale, 'billingCheckoutError'));
    }
  };

  const openPortal = async (): Promise<void> => {
    setBillingActionError(undefined);

    if (account?.emailVerified !== true) {
      setBillingActionError(t(locale, 'billingVerifyPortal'));
      return;
    }

    try {
      const { url } = await createPortal({ returnUrl: window.location.href });

      window.location.assign(url);
    } catch {
      setBillingActionError(t(locale, 'billingPortalError'));
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const submitAuth = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(undefined);
    const epoch = ++authEpoch.current;
    try {
      const response =
        authMode === 'sign-up'
          ? await signUp(authName, authEmail, authPassword)
          : await signIn(authEmail, authPassword);

      const [nextPresets, nextBilling] = await Promise.all([
        listPresets(),
        Promise.all([getBillingCatalog(), getBillingStatus()]).catch(() => undefined),
      ]);
      if (epoch !== authEpoch.current) return;
      setAccount(response.user);
      setPresets(nextPresets);
      if (nextBilling) {
        setBillingCatalog(nextBilling[0]);
        setBillingStatus(nextBilling[1]);
        setBillingError(undefined);
      } else {
        setBillingStatus(FREE_BILLING_STATUS);
        setBillingError(
          'Billing is temporarily unavailable. The free customizer remains available.',
        );
      }
      setAuthPassword('');
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const savePreset = async (name: string, currentParams = params): Promise<boolean> => {
    if (
      !account ||
      account.emailVerified !== true ||
      !billingStatus.entitlements.presets ||
      !name.trim()
    )
      return false;
    setSaveBusy(true);
    setSaveError(undefined);
    try {
      const response = await createPreset(
        name.trim(),
        presetParamsForStorage(currentParams),
        DEFAULT_PRESET_PRINT_PROFILE_ID,
      );

      setPresets((items) => [response.preset, ...items]);
      track('preset_saved', { template: 'name-keychain' });
      return true;
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Preset could not be saved.');
      return false;
    } finally {
      setSaveBusy(false);
    }
  };

  const saveCurrentPreset = async (): Promise<void> => {
    const name = window.prompt('Preset name', 'PLA contour')?.trim();

    if (name) await savePreset(name);
  };

  const loadPreset = (preset: SellerPreset): void => {
    onLoadPreset(paramsForPresetOrder(preset.params as SellerPresetParams, params.text));
    setAccountOpen(false);
  };

  const removePreset = async (preset: SellerPreset): Promise<void> => {
    if (!window.confirm(`Delete “${preset.name}”? This cannot be undone.`)) return;
    setDeletingId(preset.id);
    setDeleteError(undefined);
    try {
      await deletePreset(preset.id);
      setPresets((items) => items.filter((item) => item.id !== preset.id));
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Preset could not be deleted.');
    } finally {
      setDeletingId(undefined);
    }
  };

  const logOut = async (): Promise<void> => {
    ++authEpoch.current;
    await signOut();
    setAccount(undefined);
    setPresets([]);
    setBillingStatus(FREE_BILLING_STATUS);
    setBillingCatalog(undefined);
    setAuthMode('sign-in');
  };

  return {
    account,
    presets,
    loading,
    loadError,
    accountOpen,
    setAccountOpen,
    authMode,
    setAuthMode,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authBusy,
    authError,
    saveBusy,
    saveError,
    deletingId,
    deleteError,
    refresh,
    submitAuth,
    savePreset,
    saveCurrentPreset,
    loadPreset,
    removePreset,
    logOut,
    billingCatalog,
    billingStatus,
    billingError,
    billingBusy,
    retryBilling,
    startCheckout,
    openPortal,
    billingActionError,
  };
};
