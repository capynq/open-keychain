#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# Interactive, rerunnable bootstrap for the isolated Hetzner deployment.
# DNS and firewall changes remain manual. Existing files and Docker volumes are
# never removed without an explicit confirmation.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/../.." && pwd)
ENV_FILE=${OPEN_KEYCHAIN_ENV_FILE:-/etc/open-keychain/api.env}
NGINX_AVAILABLE=${OPEN_KEYCHAIN_NGINX_AVAILABLE:-/etc/nginx/sites-available/api.open-keychain.com}
NGINX_ENABLED=${OPEN_KEYCHAIN_NGINX_ENABLED:-/etc/nginx/sites-enabled/api.open-keychain.com}
CERT_ROOT=${OPEN_KEYCHAIN_CERT_ROOT:-/etc/letsencrypt/live}
ACME_WEBROOT=${OPEN_KEYCHAIN_ACME_WEBROOT:-/var/www/certbot}
PROJECT_NAME=open-keychain-api
TMP_DIR=
LOCK_DIR=
LOCK_ACQUIRED=0
COMPOSE_OK=0
STAGED_ENV=

say() { printf '\n[open-keychain] %s\n' "$*"; }
warn() { printf '\n[warning] %s\n' "$*" >&2; }
die() { printf '\n[error] %s\n' "$*" >&2; exit 1; }
on_error() { die "Command failed at line $1: $2"; }
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

cleanup() {
  [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf -- "$TMP_DIR"
  [[ -n "$STAGED_ENV" && -e "$STAGED_ENV" ]] && rm -f -- "$STAGED_ENV"
  if (( LOCK_ACQUIRED == 1 )); then rmdir -- "$LOCK_DIR" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

ask() {
  local prompt=$1 default=${2-} answer
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default] " answer || die 'Input was interrupted.'
    printf '%s' "${answer:-$default}"
  else
    read -r -p "$prompt " answer || die 'Input was interrupted.'
    printf '%s' "$answer"
  fi
}

ask_secret() {
  local prompt=$1 answer confirmation
  read -r -s -p "$prompt " answer || die 'Secret input was interrupted.'
  printf '\n'
  if [[ -n "$answer" ]]; then
    read -r -s -p 'Confirm: ' confirmation || die 'Secret confirmation was interrupted.'
    printf '\n'
    [[ "$answer" == "$confirmation" ]] || die 'The values did not match.'
  fi
  printf '%s' "$answer"
}

confirm() {
  local answer
  read -r -p "$1 [y/N] " answer || die 'Input was interrupted.'
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

valid_identifier() { [[ "$1" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; }
valid_hostname() {
  [[ "$1" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$ ]]
}
valid_email() { [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; }

[[ -t 0 ]] || die 'This setup is interactive and must be run from a terminal.'
[[ -f "$SCRIPT_DIR/docker-compose.yml" ]] || die "Missing deployment files under $SCRIPT_DIR."
[[ -f "$SCRIPT_DIR/nginx-api.conf.example" ]] || die 'Missing Nginx template.'
require_command bash
require_command date
require_command dirname
require_command install
require_command mktemp
require_command mv
require_command cp
require_command rm
require_command mkdir
require_command readlink
require_command openssl

LOCK_DIR=${OPEN_KEYCHAIN_SETUP_LOCK:-/run/lock/open-keychain-api.setup}
if ! mkdir -- "$LOCK_DIR" 2>/dev/null; then
  if [[ "$LOCK_DIR" == /run/* && $EUID -ne 0 ]]; then
    LOCK_DIR="${TMPDIR:-/tmp}/open-keychain-api.setup.lock"
    mkdir -- "$LOCK_DIR" 2>/dev/null || die 'Another setup process is running (or the lock directory is stale).'
  else
    die 'Another setup process is running (or the lock directory is stale).'
  fi
fi
LOCK_ACQUIRED=1

if [[ $EUID -ne 0 && "$ENV_FILE" == /etc/* ]]; then
  die 'Root is required for the selected system paths. Re-run with sudo or set custom OPEN_KEYCHAIN_* paths.'
fi

say "Preparing the Hetzner API deployment from $REPO_ROOT"
if command -v openssl >/dev/null 2>&1; then
  generate_password() { openssl rand -hex 24; }
  generate_secret() { openssl rand -hex 48; }
else
  require_command od
  require_command tr
  generate_password() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }
  generate_secret() { od -An -N48 -tx1 /dev/urandom | tr -d ' \n'; }
fi

POSTGRES_DB=$(ask 'PostgreSQL database name' 'open_keychain')
POSTGRES_USER=$(ask 'PostgreSQL user' 'open_keychain')
valid_identifier "$POSTGRES_DB" || die 'Database name must start with a lowercase letter/underscore and contain only lowercase letters, digits, or underscores.'
valid_identifier "$POSTGRES_USER" || die 'Database user must start with a lowercase letter/underscore and contain only lowercase letters, digits, or underscores.'
POSTGRES_PASSWORD=$(ask_secret 'PostgreSQL password (leave blank to generate a URL-safe password):')
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(generate_password)}
[[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9_-]{16,128}$ ]] || die 'PostgreSQL password must be 16–128 URL-safe characters.'
BETTER_AUTH_SECRET=$(ask_secret 'Better Auth secret (leave blank to generate one):')
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-$(generate_secret)}
(( ${#BETTER_AUTH_SECRET} >= 32 )) || die 'BETTER_AUTH_SECRET must contain at least 32 characters.'
APP_URL=$(ask 'Public application URL' 'https://open-keychain.com')
API_HOSTNAME=$(ask 'Public API hostname' 'api.open-keychain.com' | tr '[:upper:]' '[:lower:]')

[[ "$APP_URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || die 'APP_URL must be an HTTPS origin without a path, query, fragment, or trailing slash.'
valid_hostname "$API_HOSTNAME" || die 'API hostname is not a valid DNS hostname.'
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@open-keychain-postgres:5432/${POSTGRES_DB}"

say 'Reviewing the non-secret deployment settings:'
printf '  API hostname: %s\n  Application URL: %s\n  Database: %s (user %s)\n  ACME email: requested only if certificate issuance is needed\n' "$API_HOSTNAME" "$APP_URL" "$POSTGRES_DB" "$POSTGRES_USER"
confirm 'Write these settings and continue?' || die 'Cancelled before writing any deployment file.'

TMP_DIR=$(mktemp -d)
ENV_TMP="$TMP_DIR/api.env"
umask 077
cat > "$ENV_TMP" <<EOF
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=$DATABASE_URL
BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
APP_URL=$APP_URL
HOST=0.0.0.0
PORT=3000
ANONYMOUS_WEEKLY_EXPORTS=3
PAID_DAILY_EXPORTS=200
PAID_MINUTE_EXPORTS=6
EOF

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    say 'Validating candidate environment with Docker Compose'
    docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_TMP" config >/dev/null || die 'Compose validation failed; no live environment file was changed.'
    COMPOSE_OK=1
  else
    warn 'Docker is installed but the daemon is unavailable; skipped Compose validation and startup.'
  fi
else
  warn 'Docker Compose is unavailable; skipped Compose validation.'
fi

backup_path() {
  local target=$1 candidate index=0
  while :; do
    candidate="$target.bak.$(date +%Y%m%d-%H%M%S).$index"
    [[ ! -e "$candidate" && ! -L "$candidate" ]] && { printf '%s' "$candidate"; return; }
    index=$((index + 1))
  done
}

install_env() {
  local parent staged backup
  [[ ! -L "$ENV_FILE" ]] || die "Refusing to write through symlink: $ENV_FILE"
  if [[ -e "$ENV_FILE" && ! -f "$ENV_FILE" ]]; then die "Environment target is not a regular file: $ENV_FILE"; fi
  parent=$(dirname -- "$ENV_FILE")
  if [[ ! -d "$parent" ]]; then install -d -m 700 -- "$parent"; elif [[ ! -w "$parent" ]]; then die "Environment directory is not writable: $parent"; fi
  if [[ -e "$ENV_FILE" ]]; then
    confirm "Existing $ENV_FILE found. Back it up and replace it?" || die 'Kept the existing environment file; nothing was changed.'
    backup=$(backup_path "$ENV_FILE")
    cp -p -- "$ENV_FILE" "$backup"
    say "Backed up existing environment to $backup"
  fi
  staged=$(mktemp "$parent/.api.env.tmp.XXXXXX")
  STAGED_ENV="$staged"
  install -m 600 -- "$ENV_TMP" "$staged"
  mv -f -- "$staged" "$ENV_FILE"
  STAGED_ENV=
  say "Wrote $ENV_FILE with mode 600"
}
if (( COMPOSE_OK == 1 )); then
  VOLUME_NAME="${PROJECT_NAME}_open-keychain-postgres-data"
  if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
    warn "Existing PostgreSQL volume detected: $VOLUME_NAME"
    warn 'PostgreSQL ignores changed POSTGRES_* values after initialization; verify the DATABASE_URL credentials before reusing it.'
    confirm 'Continue while reusing this existing volume?' || die 'Stopped before touching the existing PostgreSQL volume.'
  fi
fi

install_env

CERT_DIR="$CERT_ROOT/$API_HOSTNAME"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"
CERTBOT_NEEDED=1
if [[ -r "$CERT_FILE" && -r "$KEY_FILE" ]] && openssl x509 -checkend $((30 * 86400)) -noout -in "$CERT_FILE" >/dev/null 2>&1; then
  CERTBOT_NEEDED=0
  say 'An unexpired TLS certificate was found; skipping new issuance.'
fi

if confirm "Configure Nginx and HTTPS for $API_HOSTNAME?"; then
  [[ $EUID -eq 0 ]] || die 'Root is required to configure Nginx, Certbot, and system services.'
  require_command sed
  require_command nginx
  require_command systemctl
  require_command curl
  require_command getent
  require_command cmp
  require_command sha256sum
  systemctl is-active --quiet nginx || die 'Nginx must be installed and running for webroot Certbot setup.'
  CERTBOT_RENEWAL_CHECK=0
  if (( CERTBOT_NEEDED == 1 )); then
    CERTBOT_EMAIL=$(ask 'ACME renewal email' '')
    valid_email "$CERTBOT_EMAIL" || die 'A valid ACME email address is required.'
    if ! command -v certbot >/dev/null 2>&1; then
      command -v apt-get >/dev/null 2>&1 || die 'Certbot is missing and apt-get is unavailable; install Certbot manually and rerun.'
      confirm 'Certbot is missing. Install it with apt-get now?' || die 'Certbot is required for automated HTTPS setup.'
      apt-get update
      apt-get install -y certbot
    fi
    [[ "$CERT_ROOT" == /etc/letsencrypt/live ]] || die 'Automated Certbot requires the default /etc/letsencrypt/live certificate root.'
    getent hosts "$API_HOSTNAME" >/dev/null || die "API hostname does not resolve: $API_HOSTNAME"
    [[ ! -L "$ACME_WEBROOT" ]] || die "Refusing to use symlinked ACME webroot: $ACME_WEBROOT"
    mkdir -p -- "$ACME_WEBROOT" "$(dirname -- "$NGINX_AVAILABLE")" "$(dirname -- "$NGINX_ENABLED")"
    chmod 755 -- "$ACME_WEBROOT"
    [[ ! -e "$NGINX_AVAILABLE.acme" && ! -L "$NGINX_AVAILABLE.acme" ]] || die "Temporary Nginx target already exists: $NGINX_AVAILABLE.acme"
    [[ ! -e "$NGINX_ENABLED.acme" && ! -L "$NGINX_ENABLED.acme" ]] || die "Temporary Nginx link already exists: $NGINX_ENABLED.acme"
    ACME_FILE="$TMP_DIR/acme.conf"
    cat > "$ACME_FILE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $API_HOSTNAME;
    location ^~ /.well-known/acme-challenge/ {
        root $ACME_WEBROOT;
        try_files \$uri =404;
    }
    location / { return 404; }
}
EOF
    install -m 644 -- "$ACME_FILE" "$NGINX_AVAILABLE.acme"
    ln -sfn -- "$NGINX_AVAILABLE.acme" "$NGINX_ENABLED.acme"
    if ! nginx -t; then
      rm -f -- "$NGINX_ENABLED.acme" "$NGINX_AVAILABLE.acme"
      nginx -t && systemctl reload nginx || true
      die 'Temporary ACME Nginx configuration failed validation; the previous configuration was restored.'
    fi
    systemctl reload nginx || {
      rm -f -- "$NGINX_ENABLED.acme" "$NGINX_AVAILABLE.acme"
      nginx -t && systemctl reload nginx || true
      die 'Nginx could not reload the temporary ACME configuration; the previous configuration was restored.'
    }
    probe_token="open-keychain-$RANDOM-$(date +%s)"
    probe_path="$ACME_WEBROOT/.well-known/acme-challenge/$probe_token"
    mkdir -p -- "$(dirname -- "$probe_path")"
    chmod 755 -- "$ACME_WEBROOT/.well-known" "$ACME_WEBROOT/.well-known/acme-challenge"
    printf '%s' "$probe_token" > "$probe_path"
    chmod 644 -- "$probe_path"
    if ! curl --fail --silent --show-error --max-time 10 "http://$API_HOSTNAME/.well-known/acme-challenge/$probe_token" | cmp -s - "$probe_path"; then
      rm -f -- "$probe_path" "$NGINX_ENABLED.acme" "$NGINX_AVAILABLE.acme"
      nginx -t && systemctl reload nginx || true
      die 'The ACME challenge path is not reachable through HTTP; check DNS, firewall port 80, and Nginx.'
    fi
    rm -f -- "$probe_path"
    current_umask=$(umask)
    umask 022
    if certbot certonly --webroot -w "$ACME_WEBROOT" -d "$API_HOSTNAME" --email "$CERTBOT_EMAIL" --agree-tos --non-interactive --keep-until-expiring; then
      certbot_status=0
    else
      certbot_status=$?
    fi
    umask "$current_umask"
    if (( certbot_status != 0 )); then
      rm -f -- "$NGINX_ENABLED.acme" "$NGINX_AVAILABLE.acme"
      nginx -t && systemctl reload nginx || true
      die 'Certbot issuance failed; the temporary ACME Nginx site was removed.'
    fi
    CERTBOT_RENEWAL_CHECK=1
    rm -f -- "$NGINX_ENABLED.acme" "$NGINX_AVAILABLE.acme"
    nginx -t && systemctl reload nginx || die 'Could not restore Nginx after Certbot cleanup.'
  fi
  [[ -r "$CERT_FILE" && -r "$KEY_FILE" ]] || die "Certificate files are still missing under $CERT_DIR."
  openssl x509 -checkend $((30 * 86400)) -noout -in "$CERT_FILE" >/dev/null || die 'Certificate is expired or expires within 30 days.'
  openssl x509 -checkhost "$API_HOSTNAME" -noout -in "$CERT_FILE" >/dev/null || die 'Certificate hostname does not match the API hostname.'
  cert_key_fingerprint=$(openssl x509 -in "$CERT_FILE" -pubkey -noout | openssl pkey -pubin -outform DER 2>/dev/null | sha256sum | awk '{print $1}')
  key_fingerprint=$(openssl pkey -in "$KEY_FILE" -pubout -outform DER 2>/dev/null | sha256sum | awk '{print $1}')
  [[ -n "$cert_key_fingerprint" && "$cert_key_fingerprint" == "$key_fingerprint" ]] || die 'TLS certificate and private key do not match.'
  if (( CERTBOT_NEEDED == 0 )) && command -v certbot >/dev/null 2>&1 && certbot certificates --cert-name "$API_HOSTNAME" >/dev/null 2>&1; then
    CERTBOT_RENEWAL_CHECK=1
  elif (( CERTBOT_NEEDED == 0 )); then
    warn 'The existing certificate is not managed by Certbot; preserving it without claiming automated renewal.'
  fi
  if (( CERTBOT_RENEWAL_CHECK == 1 )); then
    certbot renew --cert-name "$API_HOSTNAME" --dry-run || die 'Certbot renewal dry run failed; the HTTPS site was not activated.'
  fi
  NGINX_TMP="$TMP_DIR/nginx.conf"
  sed "s/api\.open-keychain\.com/$API_HOSTNAME/g" "$SCRIPT_DIR/nginx-api.conf.example" > "$NGINX_TMP"
  [[ ! -L "$NGINX_AVAILABLE" ]] || die "Refusing to replace symlinked Nginx target: $NGINX_AVAILABLE"
  [[ ! -e "$NGINX_ENABLED" || -L "$NGINX_ENABLED" ]] || die "Nginx enabled path is a regular file: $NGINX_ENABLED"
  OLD_ENABLED_TARGET=
  [[ -L "$NGINX_ENABLED" ]] && OLD_ENABLED_TARGET=$(readlink -- "$NGINX_ENABLED")
  if [[ -n "$OLD_ENABLED_TARGET" && "$OLD_ENABLED_TARGET" != "$NGINX_AVAILABLE" ]]; then
    confirm "Existing Nginx site link $NGINX_ENABLED points elsewhere. Replace it?" || die 'Kept the existing Nginx site link.'
  fi
  if [[ -e "$NGINX_AVAILABLE" ]]; then
    confirm "Existing $NGINX_AVAILABLE found. Back it up and replace it?" || die 'Kept the existing Nginx configuration.'
    NGINX_BACKUP=$(backup_path "$NGINX_AVAILABLE")
    cp -p -- "$NGINX_AVAILABLE" "$NGINX_BACKUP"
    say "Backed up existing Nginx site to $NGINX_BACKUP"
  fi
  install -m 644 -- "$NGINX_TMP" "$NGINX_AVAILABLE"
  ln -sfn -- "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  if ! nginx -t; then
    rm -f -- "$NGINX_ENABLED"
    [[ -n "$OLD_ENABLED_TARGET" ]] && ln -s -- "$OLD_ENABLED_TARGET" "$NGINX_ENABLED"
    [[ -n "${NGINX_BACKUP:-}" ]] && cp -p -- "$NGINX_BACKUP" "$NGINX_AVAILABLE" || rm -f -- "$NGINX_AVAILABLE"
    die 'Nginx validation failed; previous configuration was restored.'
  fi
  if confirm 'Reload Nginx with the validated API site now?'; then
    if ! systemctl reload nginx; then
      rm -f -- "$NGINX_ENABLED"
      [[ -n "$OLD_ENABLED_TARGET" ]] && ln -s -- "$OLD_ENABLED_TARGET" "$NGINX_ENABLED"
      [[ -n "${NGINX_BACKUP:-}" ]] && cp -p -- "$NGINX_BACKUP" "$NGINX_AVAILABLE" || rm -f -- "$NGINX_AVAILABLE"
      nginx -t && systemctl reload nginx || true
      die 'Nginx reload failed; the previous configuration was restored.'
    fi
  fi
else
  say 'Skipped Nginx and HTTPS setup.'
fi

if (( COMPOSE_OK == 1 )) && confirm 'Build and start the API/PostgreSQL Compose project now?'; then
  existing_containers=$(docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" ps -q 2>/dev/null || true)
  if [[ -n "$existing_containers" ]]; then
    warn 'Existing containers were found for this Compose project; they may be recreated with the new image/environment.'
    confirm 'Continue with the Compose update?' || die 'Stopped before changing existing Compose containers.'
  fi
  docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d --build
  require_command curl
  say 'Waiting for API migrations and health endpoint (up to 90 seconds)'
  ready=0
  for _ in {1..30}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3100/api/health >/dev/null; then ready=1; break; fi
    sleep 3
  done
  if (( ready == 0 )); then
    docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" logs --tail=120 open-keychain-api >&2 || true
    die 'API did not become healthy; Compose logs were printed and services were left running for diagnosis.'
  fi
  say 'API health check passed and migrations completed.'
elif (( COMPOSE_OK == 0 )); then
  warn 'Compose was not validated or started because Docker Compose is unavailable.'
else
  say 'Skipped starting Compose services.'
fi

say 'Setup complete.'
printf '\nNext checks:\n'
printf '  curl -fsS http://127.0.0.1:3100/api/health\n'
printf '  curl -fsS https://%s/api/health\n' "$API_HOSTNAME"
printf '  curl -fsS %s/api/health\n' "$APP_URL"
printf '  Confirm firewalls expose only SSH from the admin IP, 80, and 443.\n'
printf '  Enable daily server backups and perform an encrypted pg_dump restore test.\n'
