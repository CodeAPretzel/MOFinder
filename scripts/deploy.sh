#!/usr/bin/env bash
set -e

APP_DIR="/var/www/mofinder"
RELEASES_DIR="$APP_DIR/releases"
PM2_CONFIG="$APP_DIR/shared/ecosystem.config.js"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"

mkdir -p "$NEW_RELEASE"

echo "Cloning repo..."
GIT_SSH_COMMAND='ssh -i /home/zhenglab/.ssh/mofinder_ci_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes' \
  git clone git@github.com:CodeAPretzel/MOFinder.git "$NEW_RELEASE"

cd "$NEW_RELEASE"

echo "Installing dependencies..."
npm ci

#################
# Begin Logging #
#################

echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "NPM_CONFIG_PRODUCTION=$NPM_CONFIG_PRODUCTION"
echo "NODE_ENV=$NODE_ENV"
npm config get production || true

node -v
npm -v
which node
ldd "$(which node)" || true

free -h
df -h

echo "Checking TS deps..."
node -p "require.resolve('typescript')" 
node -p "require.resolve('@types/node/package.json')"
node -p "require.resolve('@types/react/package.json')"

###############
# End Logging #
###############

echo "Symlink .env to prod..."
ln -sfn "$APP_DIR/shared/.env" "$NEW_RELEASE/.env"

echo "Building..."
npm run build

echo "Prune devDeps"
npm prune --omit=dev

echo "Switching symlink..."
ln -sfn "$NEW_RELEASE" "$APP_DIR/current"

echo "Reloading or starting PM2..."
if pm2 describe mofinder >/dev/null 2>&1; then
    pm2 restart "$PM2_CONFIG" --only mofinder --update-env
else
    pm2 start npm "$PM2_CONFIG" --only mofinder
fi

pm2 save

echo "Deployment complete."

# Keep last 5 releases
ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
