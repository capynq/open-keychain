#!/usr/bin/env bash
set -Eeuo pipefail

# Interactive, rerunnable bootstrap for the isolated Hetzner deployment.
# It never changes DNS, firewall rules, certificates, or Docker state unless
# the operator explicitly opts in at the relevant prompt.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/../.." && pwd)
ENV_FILE=${OPEN_KEYCHAIN_ENV_FILE:-/etc/open-keychain/api.env}
NGINX_AVAILABLE=${OPEN_KEYCHAIN_NGINX_AVAILABLE:-/etc/nginx/sites-available/api.open-keychain.com}
NGINX_ENABLED=${OPEN_KEYCHAIN_NGINX_ENABLED:-/etc/nginx/sites-enabled/api.open-keychain.com}
PROJECT_NAME=open-keychain-api

say() { printf '\n[open-keychain] %s\n' "$*"; }
warn() { printf '\n[warning] %s\n' "$*" >&2; }
die() { printf '\n[error] %s\n' "$*" >&2; exit 1; }
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
confirm() {
  local answer
  read -r -p "$1 [y/N] " answer || die 'Input was interrupted.'
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}
require_command() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

cleanup() { [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" ]] && rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT
trap 'die "Unexpected failure at line ${LINENO}. No existing deployment file was removed."' ERR

[[ -f "$SCRIPT_DIR/docker-compose.yml" ]] || die "Missing deployment files under $SCRIPT_DIR."
[[ -f "$SCRIPT_DIR/nginx-api.conf.example" ]] || die 'Missing Nginx template.'
if [[ $EUID -ne 0 && ( "$ENV_FILE" == /etc/* || "$NGINX_AVAILABLE" == /etc/* ) ]]; then
  die 'Root is required for /etc paths. Re-run with sudo or set custom OPEN_KEYCHAIN_* paths.'
fi

say "Preparing the Hetzner API deployment from $REPO_ROOT"
require_command mktemp
require_command install
require_command cp
require_command date

if command -v openssl >/dev/null 2>&1; then
  generate_password() { openssl rand -hex 24; }
  generate_secret() { openssl rand -base64 48 | tr -d '\n'; }
else
  require_command od
  generate_password() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }
  generate_secret() { od -An -N48 -tx1 /dev/urandom | tr -d ' \n'; }
fi

POSTGRES_DB=$(ask 'PostgreSQL database name' 'open_keychain')
POSTGRES_USER=$(ask 'PostgreSQL user' 'open_keychain')
POSTGRES_PASSWORD=$(ask 'PostgreSQL password (leave blank to generate a URL-safe password)' '')
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(generate_password)}
[[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9_-]+$ ]] || die 'PostgreSQL password must use only letters, numbers, hyphen, or underscore.'
BETTER_AUTH_SECRET=$(ask 'Better Auth secret (leave blank to generate one)' '')
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-$(generate_secret)}
(( ${#BETTER_AUTH_SECRET} >= 32 )) || die 'BETTER_AUTH_SECRET must contain at least 32 characters.'
APP_URL=$(ask 'Public application URL' 'https://open-keychain.com')
API_HOSTNAME=$(ask 'Public API hostname' 'api.open-keychain.com')

[[ "$APP_URL" =~ ^https://[^/]+$ ]] || die 'APP_URL must be an HTTPS origin without a trailing slash.'
[[ "$API_HOSTNAME" =~ ^[A-Za-z0-9.-]+$ ]] || die 'API hostname contains unsupported characters.'
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@open-keychain-postgres:5432/${POSTGRES_DB}"

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

install_env() {
  local parent backup
  parent=$(dirname -- "$ENV_FILE")
  if [[ ! -d "$parent" ]]; then
    install -d -m 700 -- "$parent"
  elif [[ ! -w "$parent" ]]; then
    die "Environment directory is not writable: $parent"
  fi
  if [[ -e "$ENV_FILE" ]]; then
    confirm "Existing $ENV_FILE found. Back it up and replace it?" || die 'Kept the existing environment file; nothing was changed.'
    backup="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
    cp -p -- "$ENV_FILE" "$backup"
    say "Backed up existing environment to $backup"
  fi
  install -m 600 -- "$ENV_TMP" "$ENV_FILE"
  say "Wrote $ENV_FILE with mode 600"
}
install_env

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  say 'Validating Docker Compose configuration'
  docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" config >/dev/null || \
    die 'Compose validation failed. The environment file was written; inspect it and rerun.'
  say 'Compose configuration is valid.'
else
  warn 'Docker Compose was not found; skipped config validation.'
fi

if confirm "Install an Nginx site for $API_HOSTNAME?"; then
  require_command sed
  NGINX_TMP="$TMP_DIR/nginx.conf"
  sed "s/api\.open-keychain\.com/$API_HOSTNAME/g" "$SCRIPT_DIR/nginx-api.conf.example" > "$NGINX_TMP"
  mkdir -p -- "$(dirname -- "$NGINX_AVAILABLE")" "$(dirname -- "$NGINX_ENABLED")"
  if [[ -e "$NGINX_AVAILABLE" ]]; then
    confirm "Existing $NGINX_AVAILABLE found. Back it up and replace it?" || die 'Kept the existing Nginx configuration.'
    cp -p -- "$NGINX_AVAILABLE" "$NGINX_AVAILABLE.bak.$(date +%Y%m%d-%H%M%S)"
  fi
  install -m 644 -- "$NGINX_TMP" "$NGINX_AVAILABLE"
  ln -sfn -- "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  say "Installed Nginx configuration at $NGINX_AVAILABLE"
  if command -v nginx >/dev/null 2>&1; then
    nginx -t || warn 'nginx -t failed (usually certificates are not installed yet); not reloading.'
    if command -v systemctl >/dev/null 2>&1 && nginx -t >/dev/null 2>&1 && confirm 'Reload Nginx now?'; then
      systemctl reload nginx
      say 'Nginx reloaded.'
    elif ! command -v systemctl >/dev/null 2>&1; then
      warn 'systemctl was not found; reload Nginx manually after nginx -t passes.'
    fi
  else
    warn 'Nginx was not found; install it and run nginx -t before reloading.'
  fi
else
  say 'Skipped Nginx installation.'
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && confirm 'Build and start the API/PostgreSQL Compose project now?'; then
  docker compose -p "$PROJECT_NAME" -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d --build
  say 'Compose services started. Check migration logs with:'
  printf '  docker compose -p %s -f %s --env-file %s logs -f open-keychain-api\n' "$PROJECT_NAME" "$SCRIPT_DIR/docker-compose.yml" "$ENV_FILE"
else
  say 'Skipped starting Compose services.'
fi

say 'Setup complete.'
printf '\nNext checks:\n'
printf '  curl -fsS http://127.0.0.1:3100/api/health\n'
printf '  curl -fsS https://%s/api/health\n' "$API_HOSTNAME"
printf '  curl -fsS %s/api/health\n' "$APP_URL"
printf '  Confirm Hetzner/Ubuntu firewalls expose only SSH (admin IP), 80, and 443.\n'
printf '  Enable daily server backups and perform an encrypted pg_dump restore test.\n'
