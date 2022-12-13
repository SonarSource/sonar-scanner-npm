import * as path from 'path';
import { spawn } from 'child_process';
import * as http from 'http';

const DEFAULT_FOLDER = path.join(__dirname, '..', 'test', 'cache', 'sonarqube-9.7.1.62043', 'bin', 'macosx-universal-64');
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 9000;
const DEFAULT_PATH = '/api/user_tokens/generate';
const DEFAULT_CREDENTIALS = 'admin:admin';

export function start(sqPath: string = DEFAULT_FOLDER) {
  const pathToBin = path.join(sqPath, 'bin', 'macosx-universal-64', 'sonar.sh');
  return spawn(`${pathToBin}`, ['console'], {stdio: 'inherit'});
}

export async function waitForStart() {
  let isSignedIn = false;
  while (! isSignedIn) {
    try {
      const response = await signIn();
      isSignedIn = response.status === 200;
    } catch (error) {
      console.log('sign in failure:', error);
    }
  }
  let isReady = false;
  while (! isReady) {

  }
}

export function signIn(): Promise<any> {
  const params = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    path: `${DEFAULT_PATH}/?name2=bob3`,
    method: 'POST',
    auth: DEFAULT_CREDENTIALS,
  };
  return new Promise((resolve, reject) => {
    http.request(params, response => {
      let responseData = ''
      response.on('data', data => {
        console.log('received', data);
        responseData += data;
      });
      response.on('close', () => {
        console.log('closin')
        resolve(responseData);
      });
      response.on('error', error => {
        reject(error);
      });
    }).end();
  });
}
