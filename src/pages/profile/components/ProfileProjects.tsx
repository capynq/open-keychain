import { Link } from 'react-router';

import { CREATE_ROUTE } from '@/app/routes';

import type { HostedProject } from '../../../features/hosted/api/hosted-api';
import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const ProfileProjects = ({
  locale,
  projects,
  deleteError,
  deletingId,
  onOpen,
  onDelete,
}: {
  locale: Locale;
  projects: HostedProject[];
  deleteError?: string;
  deletingId?: string;
  onOpen: (project: HostedProject) => void;
  onDelete: (project: HostedProject) => void;
}) => (
  <section className="profile-card profile-projects" aria-labelledby="saved-projects-title">
    <div className="profile-card-heading">
      <h2 id="saved-projects-title">{t(locale, 'profileProjects')}</h2>
      <Link to={CREATE_ROUTE}>{t(locale, 'profileCreate')}</Link>
    </div>
    {deleteError && (
      <p className="profile-error" role="alert">
        {deleteError}
      </p>
    )}
    {projects.length ? (
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <div>
              <strong>{project.name}</strong>
              <small>{new Date(project.updated_at).toLocaleDateString(locale)}</small>
            </div>
            <div className="profile-project-actions">
              <button type="button" onClick={() => onOpen(project)}>
                {t(locale, 'profileOpen')}
              </button>
              <button
                type="button"
                className="profile-delete"
                disabled={deletingId === project.id}
                onClick={() => onDelete(project)}
              >
                {t(locale, 'profileDelete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="profile-empty">{t(locale, 'profileEmpty')}</p>
    )}
  </section>
);
