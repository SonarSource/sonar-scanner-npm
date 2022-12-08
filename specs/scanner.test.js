// Regular users will call 'require('sonarqube-scanner')' - but not here: eat your own dog food! :-)
const { promise: scannerPromise } = require('../src/index');
const path = require('path');
const { assert } = require('chai');
const request = require('superagent');

describe('scanner', function () {
  describe('normal run', function () {
    before(async function () {
    });
    after(function () {});
    it.only('should run', async function () {
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
      const { body: { issues } } = await request.get('https://sonarcloud.io/api/issues/search').query({
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
