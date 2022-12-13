import * as path from 'path';
import { spawn } from 'child_process';
import * as http from 'http';
const axios = require('axios').default;

const DEFAULT_FOLDER = path.join(__dirname, '..', 'test', 'cache', 'sonarqube-9.7.1.62043', 'bin', 'macosx-universal-64');
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 9000;
const CREATE_TOKEN_PATH = '/api/user_tokens/generate';
const CREATE_PROJECT_PATH = '/api/projects/create'
const DEFAULT_CREDENTIALS = 'admin:admin';

const instance = axios.create({
  baseURL: `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
  auth: {
    username: 'admin',
    password: 'admin2',
  },
})

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

export async function signIn(): Promise<any> {
  const name = generateId();
  return await instance.post(`${CREATE_TOKEN_PATH}?name=${name}`)
}

export async function createProject(): Promise<any> {
  const project = generateId();
  return await instance.post(`${CREATE_PROJECT_PATH}?name=${project}&project=${project}`)
}

export function signIn2(): Promise<any> {
  const params = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    path: `${CREATE_TOKEN_PATH}?name2=bob3`,
    method: 'POST',
    auth: DEFAULT_CREDENTIALS,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
  }
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

function generateId(length: number = 10): string {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result + '1';
}
