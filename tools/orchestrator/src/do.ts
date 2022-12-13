
import { generateToken, createProject, waitForStart } from './sonarqube';

(async () => {
  try {
    await waitForStart();
    let response = await generateToken();
    console.log('replied with', response.data);
    response = await createProject();
    console.log('repliedWith', response.data);
  } catch (err: any) {
    console.log('yo', err.response.data);
  }

})();
