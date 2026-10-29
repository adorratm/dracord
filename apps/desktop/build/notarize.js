/**
 * electron-builder afterSign — APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID
 * yoksa no-op (imzasız / sadece signed CI).
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  if (!appleId || !appleIdPassword || !teamId) {
    console.log('notarize: skipped (APPLE_ID / password / TEAM_ID missing)');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { notarize } = require('@electron/notarize');
  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log('notarize: ok');
};
