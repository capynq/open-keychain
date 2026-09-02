import { useEffect, useState, type FormEvent } from 'react';

import type { KeychainParams } from '../../../domain/keychain/model/types';
import type { Locale } from '../../../infrastructure/i18n/config';

import { FONT_CATALOG } from '../../../domain/keychain/fonts/catalog';
import { isLocalFontId } from '../../../domain/keychain/fonts/local-provider';
import { t } from '../../../infrastructure/i18n/utils';
import {
  currentUser,
  listProjects,
  saveProject,
  signIn,
  signOut,
  signUp,
  type HostedProject,
  type HostedUser,
} from '../api/hosted-api';
import { HOSTED_PROJECT_SCHEMA_VERSION } from '../api/hosted-api';
import { hostedMode } from '../config';

export type HostedAccountState = {
  account: HostedUser | undefined;
  projects: HostedProject[];
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
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  loadProject: (project: HostedProject) => void;
  logOut: () => Promise<void>;
};

export const useHostedAccount = (
  params: KeychainParams,
  onLoadProject: (params: KeychainParams) => void,
  locale: Locale = 'en',
): HostedAccountState => {
  const [account, setAccount] = useState<HostedUser>();
  const [projects, setProjects] = useState<HostedProject[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();

  useEffect(() => {
    if (!hostedMode) return;
    void currentUser().then((user) => {
      setAccount(user);

      if (user)
        void listProjects()
          .then(setProjects)
          .catch(() => setProjects([]));
    });
  }, []);

  const submitAuth = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      const response =
        authMode === 'sign-up'
          ? await signUp(authName, authEmail, authPassword)
          : await signIn(authEmail, authPassword);

      setAccount(response.user);
      setProjects(await listProjects());
      setAuthPassword('');
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const saveCurrentProject = async (): Promise<void> => {
    if (!account) return;
    const name = window.prompt('Project name', params.text || 'Untitled keychain')?.trim();
    if (!name) return;
    try {
      const hostedParams = {
        ...params,
        fontId: isLocalFontId(params.fontId) ? FONT_CATALOG[0].id : params.fontId,
      } as unknown as Record<string, unknown>;
      const response = await saveProject(name, hostedParams);

      setProjects((current) => [
        response.project,
        ...current.filter((project) => project.id !== response.project.id),
      ]);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Project could not be saved.');
      setAccountOpen(true);
    }
  };

  const loadProject = (project: HostedProject): void => {
    if (project.schema_version !== HOSTED_PROJECT_SCHEMA_VERSION) {
      setAuthError(t(locale, 'projectOutdated'));
      setAccountOpen(true);
      return;
    }
    onLoadProject(project.params as KeychainParams);
    setAccountOpen(false);
  };

  const logOut = async (): Promise<void> => {
    await signOut();
    setAccount(undefined);
    setProjects([]);
  };

  return {
    account,
    projects,
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
    submitAuth,
    saveCurrentProject,
    loadProject,
    logOut,
  };
};
