import { getLatestSonarQube } from './download';
import { start } from './sonarqube';

(async () => {
  try {
    const latest = await getLatestSonarQube();
    console.log('finished', latest);
    const process = start(latest);
    process.on('error', err => {
      console.log('got', err);
    })
    //process.kill('SIGHUP');
  } catch (error) {
    console.log('got err', error);
  }

})();
