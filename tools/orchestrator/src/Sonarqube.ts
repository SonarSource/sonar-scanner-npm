import * as path from 'path';
import { execSync } from 'child_process';

const DEFAULT_FOLDER = path.join(__dirname, '..', 'test', 'cache', 'sonarqube-9.7.1.62043', 'bin', 'macosx-universal-64');

export function start(sqPath: string = DEFAULT_FOLDER) {
  const pathToBin = path.join(sqPath, 'bin', 'macosx-universal-64', 'sonar.sh');
  try {
    execSync(`sh ${pathToBin} console`, {stdio: 'inherit'});
  } catch (error) {
    console.log('error:', error);
    console.log('stderr:', (error as any).stdout.toString())
  }

}
