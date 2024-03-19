import fs from 'fs';
import { LogLevel, log } from './logging';
import { PlatformInfo } from './types';

/**
 * TODO: Is there any license for this code?
 * TODO: Can we trust this code? Tested in docker and it seems OK
 * @see https://github.com/microsoft/vscode/blob/64874113ad3c59e8d045f75dc2ef9d33d13f3a03/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171C1-L190C1
 */
function isAlpineLinux(): boolean {
  if (process.platform !== 'linux') {
    return false;
  }
  let content: string | undefined;
  try {
    const fileContent = fs.readFileSync('/etc/os-release');
    content = fileContent.toString();
  } catch (error) {
    try {
      const fileContent = fs.readFileSync('/usr/lib/os-release');
      content = fileContent.toString();
    } catch (error) {
      /* Ignore */
      log(LogLevel.WARN, 'Failed to read /etc/os-release or /usr/lib/os-release');
    }
  }
  return !!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === 'alpine';
}

export function getPlatformInfo(): PlatformInfo {
  const os = isAlpineLinux() ? 'alpine' : process.platform;

  return {
    os,
    arch: process.arch,
  };
}
