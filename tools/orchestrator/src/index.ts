import { getLatestSonarQube } from './download';
import { start } from './sonarqube';

(async () => {
  const latest = await getLatestSonarQube();
  console.log('finished', latest);
  start(latest);
})();
