import path from 'path';

export const SONARCLOUD_URL = 'https://sonarcloud.io';

export const SONARQUBE_JRE_PROVISIONING_MIN_VERSION = '10.5';

export const SONAR_CACHE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.sonar',
  'cache',
);
