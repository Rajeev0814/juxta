// electron-builder afterPack hook: stamp the Juxta icon onto the packaged
// executable. We do this here (rather than via electron-builder's built-in
// rcedit step) because that step is bundled with code-signing/winCodeSign,
// which is disabled. Standalone rcedit needs no winCodeSign and runs before
// the installer is assembled from this directory.
const path = require('path')
const rceditModule = require('rcedit')
const rcedit =
  typeof rceditModule === 'function'
    ? rceditModule
    : rceditModule.rcedit || rceditModule.default

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  await rcedit(exe, { icon: path.join(__dirname, 'icon.ico') })
}
