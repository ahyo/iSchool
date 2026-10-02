#!/bin/bash
# Dijalankan di komputer lokal: build frontend (mode LIVE) & bundel backend untuk server sekolah.
# Hasil: deploy/smpn3-pandak/smpn3pandak-bundle.tgz → unggah ke ~ di server lalu jalankan install.sh di sana.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/deploy/smpn3-pandak
# URL tanpa skema (//...) agar mengikuti http/https halaman web
(cd $ROOT/frontend && NEXT_PUBLIC_API_URL=//api.smppandak3-bantul.sch.id NEXT_PUBLIC_BASE_PATH= NEXT_TELEMETRY_DISABLED=1 npx next build)
STAGE=$(mktemp -d)
chmod 755 $STAGE
mkdir -p $STAGE/backend $STAGE/deploy
cp -r $ROOT/frontend/out $STAGE/web.new
cp -r $ROOT/backend/app $ROOT/backend/requirements.txt $STAGE/backend/
find $STAGE/backend -name __pycache__ -prune -exec rm -rf {} +
cp $OUT/nginx.conf $OUT/ischool-smpn3.service $STAGE/deploy/
tar -czf $OUT/smpn3pandak-bundle.tgz -C $STAGE .
rm -rf $STAGE
echo "Bundle: $OUT/smpn3pandak-bundle.tgz"
