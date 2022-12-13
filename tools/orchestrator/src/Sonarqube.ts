import * as path from 'path';
import { spawn } from 'child_process';
import * as http from 'http';
const axios = require('axios').default;

const DEFAULT_FOLDER = path.join(__dirname, '..', 'test', 'cache', 'sonarqube-9.7.1.62043', 'bin', 'macosx-universal-64');
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 9000;
const CREATE_TOKEN_PATH = '/api/user_tokens/generate';
const CREATE_PROJECT_PATH = '/api/projects/create';
const IS_READY_PATH = '/api/analysis_reports/is_queue_empty';
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
  let isReady = false;
  while (! isReady) {
    try {
      const [response] = await Promise.all([
        isApiReady(),
        sleep(),
      ]);
      isReady = response.data;
      console.log('got', isReady);
    } catch (error: any) {
      console.log('error on ready check', )
    }
  }
}

export async function isApiReady(): Promise<any> {
  return await instance.get(`${IS_READY_PATH}`);
}

export async function generateToken(): Promise<any> {
  const name = generateId();
  return await instance.post(`${CREATE_TOKEN_PATH}?name=${name}`)
}

export async function createProject(): Promise<any> {
  const project = generateId();
  return await instance.post(`${CREATE_PROJECT_PATH}?name=${project}&project=${project}`)
}

export function generateToken2(): Promise<any> {
  const params = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    path: `${CREATE_TOKEN_PATH}?name2=bob3`,
    method: 'POST',
    auth: DEFAULT_CREDENTIALS,
    /* headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
  } */
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
  // ensure that there is at least 1 number
  return result + '1';
}

function sleep(timeMs: number = 2000) {
  return new Promise(resolve => setTimeout(resolve, timeMs));
}
