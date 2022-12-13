import { getLatestSonarQube } from './download';
import { createProject, generateToken, startAndReady } from './sonarqube';

(async () => {
  try {
    const latest = await getLatestSonarQube();
    console.log('finished', latest);
    const process = await startAndReady(latest);
    const token = await generateToken();
    console.log('got token', token);
    const projectKey = await createProject();
    console.log('got project', projectKey);
    process.kill('SIGHUP');
    process.on('error', err => {
      console.log('got', err);
    })
  } catch (error) {
    console.log('got err', error);
  }

})();
