import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import type { KeychainParams } from '@/entities/keychain/model/types';

import { FONT_CATALOG } from '@/entities/keychain/fonts/catalog';
import { isLocalFontId } from '@/entities/keychain/fonts/local-provider';

import type { Locale } from '../../../infrastructure/i18n/config';

import {
  currentUser,
  deleteProject,
  listProjects,
  saveProject,
  signIn,
  signOut,
  signUp,
  type HostedProject,
  type HostedUser,
} from '../../../features/hosted/api/hosted-api';
import { t } from '../../../infrastructure/i18n/utils';

const projectParamsForHosting = (params: KeychainParams): Record<string, unknown> => ({
  ...params,
  fontId: isLocalFontId(params.fontId) ? FONT_CATALOG[0].id : params.fontId,
});

export const useProfileSession = (locale: Locale, currentParams?: KeychainParams) => {
  const [account, setAccount] = useState<HostedUser>();
  const [projects, setProjects] = useState<HostedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [projectName, setProjectName] = useState(currentParams?.text || '');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const user = await currentUser();

      setAccount(user);
      setProjects(user ? await listProjects() : []);
    } catch {
      setLoadError(t(locale, 'profileLoadError'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      const response =
        authMode === 'sign-up'
          ? await signUp(name, email, password)
          : await signIn(email, password);

      setAccount(response.user);
      setProjects(await listProjects());
      setPassword('');
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : t(locale, 'profileLoadError'));
    } finally {
      setAuthBusy(false);
    }
  };

  const defaultProjectName = useMemo(
    () => (currentParams?.text ? `${currentParams.text} keychain` : ''),
    [currentParams?.text],
  );

  const saveCurrent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!currentParams) return;

    const trimmedName = projectName.trim() || defaultProjectName;

    if (!trimmedName) return;

    setSaveBusy(true);
    setSaveError(undefined);
    try {
      const response = await saveProject(trimmedName, projectParamsForHosting(currentParams));

      setProjects((items) => [response.project, ...items]);
      setProjectName('');
    } catch {
      setSaveError(t(locale, 'profileSaveError'));
    } finally {
      setSaveBusy(false);
    }
  };

  const removeProject = async (project: HostedProject): Promise<void> => {
    if (!window.confirm(t(locale, 'profileDeleteConfirm', { name: project.name }))) return;

    setDeletingId(project.id);
    setDeleteError(undefined);
    try {
      await deleteProject(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
    } catch {
      setDeleteError(t(locale, 'profileDeleteError'));
    } finally {
      setDeletingId(undefined);
    }
  };

  const logOut = async (): Promise<void> => {
    await signOut();
    setAccount(undefined);
    setProjects([]);
  };

  return {
    account,
    projects,
    loading,
    loadError,
    authMode,
    setAuthMode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    authBusy,
    authError,
    projectName,
    setProjectName,
    saveBusy,
    saveError,
    deletingId,
    deleteError,
    refresh,
    submitAuth,
    defaultProjectName,
    saveCurrent,
    removeProject,
    logOut,
  };
};
