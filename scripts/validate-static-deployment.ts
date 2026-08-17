export {};

const baseUrl = (process.env.SELF_HOSTED_BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

const fetchChecked = async (pathname: string): Promise<Response> => {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`);
  return response;
};

const expectContentType = (response: Response, expected: string, pathname: string): void => {
  const actual = response.headers.get('content-type') ?? '';
  if (!actual.toLowerCase().includes(expected))
    throw new Error(`${pathname} has content-type ${actual || '<missing>'}; expected ${expected}`);
};

const expectCache = (response: Response, expectation: RegExp, pathname: string): void => {
  const actual = response.headers.get('cache-control') ?? '';
  if (!expectation.test(actual))
    throw new Error(`${pathname} has cache-control ${actual || '<missing>'}`);
};

const expectHeader = (response: Response, name: string, expected: string): void => {
  const actual = response.headers.get(name) ?? '';
  if (actual.toLowerCase() !== expected.toLowerCase())
    throw new Error(`/: header ${name} is ${actual || '<missing>'}; expected ${expected}`);
};

const root = await fetchChecked('/');
expectContentType(root, 'text/html', '/');
expectCache(root, /(?:no-cache|max-age=0|must-revalidate)/i, '/');
expectHeader(root, 'x-content-type-options', 'nosniff');
expectHeader(root, 'x-frame-options', 'DENY');
expectHeader(root, 'referrer-policy', 'strict-origin-when-cross-origin');
expectHeader(root, 'permissions-policy', 'camera=(), microphone=(), geolocation=()');
const html = await root.text();
if (!html.includes('id="root"')) throw new Error('/ does not contain the application root');

const robots = await fetchChecked('/robots.txt');
expectContentType(robots, 'text/plain', '/robots.txt');
if (!(await robots.text()).includes('Sitemap: https://open-keychain.com/sitemap.xml'))
  throw new Error('/robots.txt does not advertise the sitemap');

const sitemap = await fetchChecked('/sitemap.xml');
expectContentType(sitemap, 'application/xml', '/sitemap.xml');
if (!(await sitemap.text()).includes('<loc>https://open-keychain.com/</loc>'))
  throw new Error('/sitemap.xml does not contain the canonical landing URL');

const assetPath = html.match(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))"/)?.[1];
if (!assetPath) throw new Error('Could not find a hashed JS/CSS asset in index.html');
const asset = await fetchChecked(assetPath);
expectCache(asset, /max-age=31536000.*immutable/i, assetPath);

const wasm = await fetchChecked('/manifold.wasm');
expectContentType(wasm, 'application/wasm', '/manifold.wasm');
expectCache(wasm, /(?:max-age=0|must-revalidate)/i, '/manifold.wasm');
if ((await wasm.arrayBuffer()).byteLength < 100_000) throw new Error('/manifold.wasm is too small');

const font = await fetchChecked('/fonts/nunito.ttf');
expectContentType(font, 'font/ttf', '/fonts/nunito.ttf');
expectCache(font, /(?:max-age=0|must-revalidate)/i, '/fonts/nunito.ttf');
if ((await font.arrayBuffer()).byteLength < 10_000)
  throw new Error('/fonts/nunito.ttf is too small');

for (const route of ['/create', '/self-hosted-validation/deep-link']) {
  const fallback = await fetchChecked(route);

  expectContentType(fallback, 'text/html', route);
  if (!(await fallback.text()).includes('id="root"')) throw new Error(`${route} is not index.html`);
}

console.log(JSON.stringify({ baseUrl, assetPath, status: 'passed' }));
