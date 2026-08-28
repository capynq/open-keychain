import styles from './LandingSectionHeading.module.css';

export const LandingSectionHeading = ({
  kicker,
  title,
  body,
  titleId,
}: {
  kicker: string;
  title: string;
  body?: string;
  titleId: string;
}) => (
  <div className={`${styles.root} landing-section-heading`}>
    <p className="landing-kicker">{kicker}</p>
    <h2 id={titleId}>{title}</h2>
    {body && <p className="landing-section-description">{body}</p>}
  </div>
);
