
import { signIn } from './sonarqube';

(async () => {
  try {
    const response = await signIn();
    console.log('replied with', response.data);
  } catch (err: any) {
    console.log('yo', err.response.data);
  }

})();
