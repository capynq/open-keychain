/**
 * Hands the page from the pre-React boot frame to the live tree. `data-app-ready` keeps meaning
 * "React committed" (the boot recovery script and tests depend on it). On the landing page the
 * frame stays up until the live hero image can paint, at most `HERO_DECODE_CAP_MS`, so the swap
 * never shows an empty slide where the frame already had the decoded picture.
 */
const HERO_DECODE_CAP_MS = 150;
const LIVE_HERO_IMAGE = '#root .configurator-carousel-slide[data-showcase-kind="configurator"] img';

let committed = false;

const clearFrame = () => {
  delete document.documentElement.dataset.bootHandoff;
  document.getElementById('boot-frame')?.replaceChildren();
};

export const commitBoot = ({ awaitHero = true }: { awaitHero?: boolean } = {}): void => {
  const root = document.getElementById('root');

  root?.removeAttribute('inert');
  root?.setAttribute('data-app-ready', 'true');
  document.documentElement.setAttribute('data-app-ready', 'true');
  if (committed) return;
  committed = true;

  const html = document.documentElement;
  const hero =
    awaitHero && html.dataset.bootRoute === 'landing'
      ? document.querySelector<HTMLImageElement>(LIVE_HERO_IMAGE)
      : null;
  if (!hero?.complete || !hero.naturalWidth) {
    clearFrame();
    return;
  }
  html.dataset.bootHandoff = 'pending';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearFrame();
  };

  hero.decode().then(finish, finish);
  window.setTimeout(finish, HERO_DECODE_CAP_MS);
};
