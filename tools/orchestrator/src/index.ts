import { getLatestSonarQube } from './download';
import { createProject, generateToken, startAndReady, stop } from './sonarqube';

(async () => {
  try {
    const latest = await getLatestSonarQube();
    console.log('finished', latest);
    await startAndReady(latest);
    const token = await generateToken();
    console.log('got token', token);
    const projectKey = await createProject();
    console.log('got project', projectKey);
    stop(latest);
    process.on('error', err => {
      console.log('got', err);
    })
  } catch (error) {
    console.log('got err', error);
  }

})();
