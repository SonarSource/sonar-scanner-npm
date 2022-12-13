const { getLatestSonarQube } = require('../dist/download');
const { createProject, generateToken, startAndReady, stop } = require('../dist/sonarqube');

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
  } catch (error) {
    console.log('got err', error);
  }
})();
