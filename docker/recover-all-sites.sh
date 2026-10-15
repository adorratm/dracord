#!/usr/bin/env bash
# Shared Hetzner VPS — tüm siteleri (nginx + kardeş stack + Dracord) ayağa kaldır.
#
# Kullanım (sunucuda):
#   sudo bash /opt/dracord/docker/recover-all-sites.sh
#
# Ne zaman: docker/containerd restart sonrası, 521 / "No vhost", kardeş siteler Exited.
# Güvenli: çalışan konteynerleri öldürmez; start + nginx conf restore + smoke.
set -euo pipefail

NGINX_CTN="${DRACORD_NGINX_CONTAINER:-ttengamesstudio-nginx}"
NETWORK="${DRACORD_TTEN_NETWORK:-ttengamesstudio_ttengamesstudio-network}"
TTEN_TPL="${TTEN_TEMPLATES:-/opt/ttengamesstudio/docker/nginx/templates}"
SSL_HOST="${TTEN_SSL_HOST:-/opt/ttengamesstudio/docker/ssl}"
DRACORD_ROOT="${DRACORD_ROOT:-/opt/dracord}"
HYDRORAGE_HOST_CONF="${HYDRORAGE_HOST_CONF:-/opt/hydrorage/docker/nginx/host/hydrorage.conf}"

log() { echo "==> $*"; }
ok() { echo "  OK  $*"; }
warn() { echo "  !! $*" >&2; }

need_docker() {
  if ! systemctl is-active --quiet docker 2>/dev/null; then
    log "Docker başlatılıyor"
    systemctl start containerd docker || true
    sleep 2
  fi
  docker info >/dev/null
}

start_one() {
  local name="$1"
  if docker inspect "$name" >/dev/null 2>&1; then
    local st
    st="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)"
    if [[ "$st" != "running" ]]; then
      docker start "$name" >/dev/null && ok "start $name" || warn "start failed: $name"
    else
      ok "already up $name"
    fi
  else
    warn "container yok: $name"
  fi
}

start_many() {
  local c
  for c in "$@"; do
    start_one "$c"
  done
}

ensure_network_alias() {
  local ctn="$1"
  local alias="$2"
  if ! docker inspect "$ctn" >/dev/null 2>&1; then
    warn "network skip (missing): $ctn"
    return 0
  fi
  docker network disconnect "$NETWORK" "$ctn" 2>/dev/null || true
  if docker network connect --alias "$alias" "$NETWORK" "$ctn" 2>/dev/null; then
    ok "network $ctn alias=$alias"
  else
    docker network connect "$NETWORK" "$ctn" 2>/dev/null || true
    warn "alias $alias bağlanamadı ($ctn) — düz connect denendi"
  fi
}

restore_conf_from_template() {
  local name="$1" # dosya adı conf.d içinde
  local src="$2"
  if [[ ! -f "$src" ]]; then
    warn "template yok: $src"
    return 0
  fi
  docker cp "$src" "$NGINX_CTN:/etc/nginx/conf.d/$name"
  ok "conf.d/$name ← $src"
}

# --- 0. Docker ---
need_docker

# --- 1. Paylaşılan nginx (80/443) ---
log "Paylaşılan nginx"
start_one "$NGINX_CTN"
sleep 1
if ! docker exec "$NGINX_CTN" true 2>/dev/null; then
  warn "$NGINX_CTN çalışmıyor — devam edilemez"
  exit 1
fi

# --- 2. Veritabanları / redis ---
log "DB / Redis"
start_many \
  ttengamesstudio-postgres ttengamesstudio-redis \
  kiliccoffee-prod-postgres kiliccoffee-prod-redis \
  portfolio-prod-postgres portfolio-prod-pgbouncer portfolio-prod-redis \
  hydrorage-postgres-1 hydrorage-redis-1 hydrorage-pgbouncer-1

# --- 3. Uygulamalar ---
log "Uygulamalar"
start_many \
  ttengamesstudio-backend ttengamesstudio-frontend ttengamesstudio-admin \
  kiliccoffee-prod-api kiliccoffee-prod-frontend kiliccoffee-prod-admin \
  portfolio-prod-backend portfolio-prod-frontend portfolio-prod-admin \
  hydrorage-web-1 hydrorage-admin-1 hydrorage-api_green-1 hydrorage-nginx-1

# --- 4. Dracord (varsa) ---
log "Dracord stack"
start_many \
  docker-postgres-1 docker-pgbouncer-1 docker-redis-1 docker-elasticsearch-1 \
  docker-livekit-1 docker-edge-1 docker-music-bot-1 docker-bgutil-provider-1

# Esnek: replica adları (docker-api-236 vb.)
while IFS= read -r c; do
  [[ -n "$c" ]] && start_one "$c"
done < <(docker ps -a --format '{{.Names}}' | grep -E '^docker-(edge|api|web|admin|livekit)-' || true)

if [[ -x "$DRACORD_ROOT/docker/recover-stack.sh" ]] || [[ -f "$DRACORD_ROOT/docker/recover-stack.sh" ]]; then
  log "Dracord recover-stack.sh"
  (cd "$DRACORD_ROOT" && bash docker/recover-stack.sh) || warn "recover-stack.sh hata (devam)"
fi

# --- 5. Hydrorage SSL (host volume → container /etc/nginx/ssl) ---
log "Hydrorage SSL"
mkdir -p "$SSL_HOST/hydrorage"
if [[ ! -f "$SSL_HOST/hydrorage/fullchain.pem" ]] || [[ ! -f "$SSL_HOST/hydrorage/privkey.pem" ]]; then
  if docker exec "$NGINX_CTN" test -f /etc/nginx/conf.d/hydrorage.fullchain.pem 2>/dev/null; then
    docker cp "$NGINX_CTN:/etc/nginx/conf.d/hydrorage.fullchain.pem" "$SSL_HOST/hydrorage/fullchain.pem"
    docker cp "$NGINX_CTN:/etc/nginx/conf.d/hydrorage.privkey.pem" "$SSL_HOST/hydrorage/privkey.pem"
    ok "SSL conf.d PEM → $SSL_HOST/hydrorage"
  else
    warn "Hydrorage PEM yok: $SSL_HOST/hydrorage/{fullchain,privkey}.pem"
  fi
else
  ok "SSL mevcut $SSL_HOST/hydrorage"
fi

# --- 6. Hydrorage conf: Docker nginx için upstream düzelt ---
log "Hydrorage / kardeş vhost templates"
if [[ -f "$HYDRORAGE_HOST_CONF" ]]; then
  # Host-nginx 127.0.0.1:9080 → Docker ağında hydrorage-nginx-1:80
  if grep -q '127.0.0.1:9080' "$HYDRORAGE_HOST_CONF"; then
    sed -i 's|server 127\.0\.0\.1:9080;|server hydrorage-nginx-1:80;|' "$HYDRORAGE_HOST_CONF"
    ok "hydrorage.conf upstream → hydrorage-nginx-1:80"
  fi
  cp "$HYDRORAGE_HOST_CONF" "$TTEN_TPL/hydrorage.conf"
fi

# Kilic / portfolio / hydrorage / dracord conf.d
[[ -f "$TTEN_TPL/kiliccoffee.conf" ]] && restore_conf_from_template kiliccoffee.conf "$TTEN_TPL/kiliccoffee.conf"
[[ -f "$TTEN_TPL/portfolio.conf" ]] && restore_conf_from_template portfolio.conf "$TTEN_TPL/portfolio.conf"
[[ -f "$TTEN_TPL/portfolio-emrekilic.conf" ]] && restore_conf_from_template portfolio-emrekilic.conf "$TTEN_TPL/portfolio-emrekilic.conf"
[[ -f "$TTEN_TPL/hydrorage.conf" ]] && restore_conf_from_template hydrorage.conf "$TTEN_TPL/hydrorage.conf"
[[ -f "$TTEN_TPL/dracord.conf" ]] && restore_conf_from_template dracord.conf "$TTEN_TPL/dracord.conf"

ensure_network_alias hydrorage-nginx-1 hydrorage-nginx
ensure_network_alias docker-edge-1 dracord-edge
ensure_network_alias docker-livekit-1 dracord-livekit

# --- 7. nginx -t + reload ---
log "nginx -t + reload"
if docker exec "$NGINX_CTN" nginx -t; then
  docker exec "$NGINX_CTN" nginx -s reload
  ok "nginx reloaded"
else
  warn "nginx -t FAILED — conf.d kontrol et"
  docker exec "$NGINX_CTN" ls -la /etc/nginx/conf.d/ || true
  exit 1
fi

# --- 8. Dracord sync (edge alias + smoke) ---
if [[ -f "$DRACORD_ROOT/docker/sync-dracord-nginx.sh" ]]; then
  log "sync-dracord-nginx.sh auto"
  (cd "$DRACORD_ROOT" && bash docker/sync-dracord-nginx.sh auto) || warn "dracord sync hata"
fi

# --- 9. Smoke ---
log "Smoke"
ss -tlnp 2>/dev/null | grep -E ':80|:443' || true
for host in \
  ttengamesstudio.com.tr \
  kiliccoffeeroaster.com.tr \
  emrekilic.web.tr \
  hydrorage.com.tr \
  dracord.com.tr; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $host" http://127.0.0.1/ 2>/dev/null || echo 000)"
  body="$(curl -sS -H "Host: $host" http://127.0.0.1/ 2>/dev/null | head -c 80 || true)"
  if echo "$body" | grep -qi 'No vhost for this host'; then
    echo "  FAIL $host HTTP $code (No vhost)"
  else
    echo "  HTTP $host → $code"
  fi
done

for host in hydrorage.com.tr dracord.com.tr kiliccoffeeroaster.com.tr; do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null || echo 000)"
  echo "  HTTPS $host → $code"
done

log "Bitti. Hâlâ 521 ise Cloudflare origin IP / firewall kontrol et."
echo "  docker ps --format 'table {{.Names}}\t{{.Status}}' | head -40"
