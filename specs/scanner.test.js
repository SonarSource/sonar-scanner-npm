// Regular users will call 'require('sonarqube-scanner')' - but not here: eat your own dog food! :-)
const { promise: scannerPromise } = require('../src/index');
const path = require('path');
const { assert } = require('chai');
const {
  getLatestSonarQube,
  createProject,
  generateToken,
  startAndReady,
  stop,
  getIssues,
} = require('../tools/orchestrator');

describe('scanner', function () {
  describe('on local SonarQube', function () {
    let sqPath, token, projectKey;
    before(async function () {
      this.timeout(60 * 1000);
      sqPath = await getLatestSonarQube();
      await startAndReady(sqPath);
      try {
        token = await generateToken();
        console.log('got token', token);
        projectKey = await createProject();
      } catch (error) {
        console.log(error);
      }
    });
    after(function () {
      this.timeout(10 * 1000);
      stop(sqPath);
    });
    it.only('should run an analysis', async function () {
      await scannerPromise({
        serverUrl: 'http://localhost:9000',
        token,
        options: {
          'sonar.projectName': projectKey,
          'sonar.projectKey': projectKey,
          'sonar.sources': path.join(__dirname, '/resources/fake_project_for_integration/src'),
        },
      });
      const issues = await getIssues(projectKey);
      assert.equal(issues.length, 1);
      assert.deepEqual(issues[0].textRange, {
        startLine: 1,
        endLine: 1,
        startOffset: 0,
        endOffset: 13,
      });
    }).timeout(60 * 1000);
  });
  describe.skip('on SonarCloud', function () {
    before(async function () {});
    after(function () {});
    it('should run', async function () {
      await scannerPromise({
        serverUrl: 'https://sonarcloud.io/',
        token: process.env.SONAR_TOKEN,
        options: {
          'sonar.projectName': 'test-scanner',
          'sonar.organization': 'ilia-kebets-sonarsource',
          'sonar.sources': path.join(__dirname, '/resources/fake_project_for_integration/src'),
          //'sonar.tests': './resources/fake_project_for_integration/test'
        },
      });
      const {
        body: { issues },
      } = await request.get('https://sonarcloud.io/api/issues/search').query({
        projects: 'ilia-kebets-sonarsource_sonar-scanner-npm',
        token: process.env.SONAR_TOKEN,
      });
      const myIssues = issues.filter(issue =>
        issue.component.includes('specs/resources/fake_project_for_integration/src/index.js'),
      );
      assert.equal(myIssues.length, 1);
      const myIssue = myIssues[0];
      assert.deepEqual(myIssue.textRange, {
        startLine: 1,
        endLine: 1,
        startOffset: 0,
        endOffset: 7,
      });
    }).timeout(60 * 1000);
  });
});
