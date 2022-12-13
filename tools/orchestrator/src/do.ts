
import { signIn } from './sonarqube';

(async () => {
  try {
    console.log('replied with', await signIn());
  } catch (err) {
    console.log('yo', err);
  }

})();
