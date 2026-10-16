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

remove_conf_d() {
  local name="$1"
  if docker exec "$NGINX_CTN" test -f "/etc/nginx/conf.d/$name" 2>/dev/null; then
    docker exec "$NGINX_CTN" rm -f "/etc/nginx/conf.d/$name"
    ok "conf.d/$name kaldırıldı (çakışma önleme)"
  fi
}

# Aynı server_name iki conf’ta olursa nginx ikincisini ignore eder → yanlış site / 500.
# portfolio.conf + portfolio-emrekilic.conf ikisi de emrekilic.web.tr tanımlıyor.
pick_portfolio_vhost() {
  local emre="$TTEN_TPL/portfolio-emrekilic.conf"
  local port="$TTEN_TPL/portfolio.conf"
  if [[ -f "$emre" ]]; then
    restore_conf_from_template portfolio-emrekilic.conf "$emre"
    remove_conf_d portfolio.conf
    # Host mirror’da da çift kalmasın diye uyarı
    if [[ -f "$port" ]]; then
      warn "portfolio.conf atlandı (portfolio-emrekilic.conf tercih); emrekilic.web.tr çakışması önlendi"
    fi
  elif [[ -f "$port" ]]; then
    restore_conf_from_template portfolio.conf "$port"
    remove_conf_d portfolio-emrekilic.conf
  else
    warn "portfolio template yok"
  fi
}

# hydrorage.conf, default.conf içinde zaten hydrorage.com.tr varsa ignore edilir.
# Asıl hydrorage vhost’un hangisi olduğunu raporla.
report_server_name_conflicts() {
  log "server_name çakışma taraması"
  docker exec "$NGINX_CTN" sh -c '
    tmp=$(mktemp)
    for f in /etc/nginx/conf.d/*.conf; do
      [ -f "$f" ] || continue
      # server_name satırlarındaki hostları çıkar
      grep -oE "server_name[[:space:]]+[^;]+" "$f" 2>/dev/null \
        | sed "s/server_name[[:space:]]*//" \
        | tr " " "\n" \
        | grep -E "[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" \
        | while read -r h; do
            echo "$h $(basename "$f")"
          done
    done | sort > "$tmp"
    awk "{c[\$1]++; f[\$1]=f[\$1] \" \" \$2} END {for (h in c) if (c[h]>1) print \"CONFLICT\", h, \"→\" f[h]}" "$tmp"
    rm -f "$tmp"
  ' 2>/dev/null || true
}

https_smoke() {
  local host="$1"
  local code body
  code="$(curl -sk -o /tmp/recover-https-body -w '%{http_code}' --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null || echo 000)"
  body="$(head -c 120 /tmp/recover-https-body 2>/dev/null | tr '\n' ' ' || true)"
  if [[ "$code" == "500" ]] || [[ "$code" == "502" ]] || [[ "$code" == "503" ]]; then
    echo "  FAIL HTTPS $host → $code  body≈ ${body:0:80}"
  else
    echo "  HTTPS $host → $code"
  fi
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
# ÖNEMLİ: portfolio + portfolio-emrekilic birlikte → conflicting server_name (emrekilic)
[[ -f "$TTEN_TPL/kiliccoffee.conf" ]] && restore_conf_from_template kiliccoffee.conf "$TTEN_TPL/kiliccoffee.conf"
pick_portfolio_vhost
[[ -f "$TTEN_TPL/hydrorage.conf" ]] && restore_conf_from_template hydrorage.conf "$TTEN_TPL/hydrorage.conf"
[[ -f "$TTEN_TPL/dracord.conf" ]] && restore_conf_from_template dracord.conf "$TTEN_TPL/dracord.conf"

# default.conf içinde hydrorage / emrekilic varsa hydrorage.conf ile çakışır — raporla
report_server_name_conflicts

ensure_network_alias hydrorage-nginx-1 hydrorage-nginx
ensure_network_alias docker-edge-1 dracord-edge
ensure_network_alias docker-livekit-1 dracord-livekit

# --- 7. nginx -t + reload ---
log "nginx -t + reload"
# nginx -t uyarıları stderr’de; “conflicting server name” varsa net yaz
nginx_test_out="$(docker exec "$NGINX_CTN" nginx -t 2>&1)" || true
echo "$nginx_test_out" | grep -i 'conflicting server name' | sort -u | while read -r line; do
  warn "$line"
done
if echo "$nginx_test_out" | grep -q 'test is successful'; then
  docker exec "$NGINX_CTN" nginx -s reload
  ok "nginx reloaded"
else
  echo "$nginx_test_out" >&2
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

for host in \
  ttengamesstudio.com.tr \
  kiliccoffeeroaster.com.tr \
  emrekilic.web.tr \
  hydrorage.com.tr \
  dracord.com.tr; do
  https_smoke "$host"
done

# Hangi vhost hangi host’a bakıyor (yanlış site şüphesi)
log "vhost map (server_name → conf)"
docker exec "$NGINX_CTN" sh -c '
  for f in /etc/nginx/conf.d/*.conf; do
    [ -f "$f" ] || continue
    names=$(grep -oE "server_name[[:space:]]+[^;]+" "$f" 2>/dev/null | head -3 | tr "\n" "; ")
    echo "  $(basename "$f"): $names"
  done
' 2>/dev/null || true

log "Bitti. Hâlâ 521 ise Cloudflare origin IP / firewall kontrol et."
echo "  docker ps --format 'table {{.Names}}\t{{.Status}}' | head -40"
echo "  ttengamesstudio 500 ise: docker logs ttengamesstudio-frontend --tail 80"
