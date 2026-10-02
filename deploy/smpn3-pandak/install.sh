#!/bin/bash
# Dijalankan di server (user aio) setelah bundle diunggah ke ~/smpn3pandak-bundle.tgz.
# Pertama kali: membuat database, .env, venv, data master & akun admin. Berikutnya: hanya memperbarui kode.
set -euo pipefail
APP=/var/www/smpn3pandak
DB=ischool_smpn3
WEB_ORIGINS="http://web.smppandak3-bantul.sch.id,https://web.smppandak3-bantul.sch.id"

sudo mkdir -p $APP && sudo chown aio:aio $APP
tar -xzf ~/smpn3pandak-bundle.tgz -C $APP   # -> backend/, web.new/, deploy/
chmod 755 $APP
rm -rf $APP/web.old; [ -d $APP/web ] && mv $APP/web $APP/web.old; mv $APP/web.new $APP/web

# Python 3.12 terpisah (Debian 11 hanya punya 3.9) via uv
command -v ~/.local/bin/uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
cd $APP/backend
[ -d .venv ] || ~/.local/bin/uv venv --python 3.12 .venv
~/.local/bin/uv pip install --python .venv/bin/python -q -r requirements.txt

FIRST=0
if [ ! -f .env ]; then
  FIRST=1
  DBPASS=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')
  # Server ini memakai autentikasi password untuk PostgreSQL: berikan PGADMIN_PASSWORD (user postgres)
  : "${PGADMIN_PASSWORD:?Set PGADMIN_PASSWORD (password user postgres) untuk instalasi pertama}"
  PGPASSWORD=$PGADMIN_PASSWORD psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE ROLE $DB LOGIN PASSWORD '$DBPASS'" -c "CREATE DATABASE $DB OWNER $DB"
  umask 077
  cat > .env <<ENV
DATABASE_URL=postgresql+psycopg://$DB:$DBPASS@127.0.0.1:5432/$DB
SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')
CORS_ORIGINS=$WEB_ORIGINS
ENV
  umask 022
fi

sudo cp $APP/deploy/ischool-smpn3.service /etc/systemd/system/
sudo cp $APP/deploy/nginx.conf /etc/nginx/sites-available/smpn3pandak
sudo ln -sf /etc/nginx/sites-available/smpn3pandak /etc/nginx/sites-enabled/smpn3pandak
sudo nginx -t
sudo systemctl daemon-reload

if [ $FIRST = 1 ]; then
  .venv/bin/python -m app.setup_school   # mencetak password admin awal
else
  .venv/bin/python -c "from app.database import Base, engine; import app.models; Base.metadata.create_all(engine)"
fi
sudo systemctl enable -q --now ischool-smpn3 && sudo systemctl restart ischool-smpn3
sudo systemctl reload nginx
sleep 2
curl -sf -H 'Host: api.smppandak3-bantul.sch.id' http://127.0.0.1/api/health && echo
curl -s -o /dev/null -w 'web %{http_code}\n' -H 'Host: web.smppandak3-bantul.sch.id' http://127.0.0.1/
