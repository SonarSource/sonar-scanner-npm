
import { signIn, createProject } from './sonarqube';

(async () => {
  try {
    let response = await signIn();
    console.log('replied with', response.data);
    response = await createProject();
    console.log('repliedWith', response.data);
  } catch (err: any) {
    console.log('yo', err.response.data);
  }

})();
