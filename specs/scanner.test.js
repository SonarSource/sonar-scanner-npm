// Regular users will call 'require('sonarqube-scanner')' - but not here: eat your own dog food! :-)
const { promise: scannerPromise } = require('../src/index');
const path = require('path');
const { assert } = require('chai');

describe('scanner', function () {
  describe('normal run', function () {
    before(function () {

    });
    after(function () {

    });
    it.only('should run', async function () {
      try {
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
      } catch (err) {
        assert.fail(`should not fail. Failed with error: ${err.message}`);
      }
      console.log('done woop');

    }).timeout(20 * 1000);
  });
});
