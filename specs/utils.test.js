const assert = require('assert');
const utils = require('../src/utils');
const sinon = require('sinon');


describe('findTargetOS()', function () {
  it('detect Windows', function () {
    const stub = sinon.stub(utils, 'isWindows');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'windows');
  });

  it('detect Mac', function () {
    const stub = sinon.stub(utils, 'isMac');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'macosx');
  });

  it('detect Linux', function () {
    const stub = sinon.stub(utils, 'isLinux');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'linux');
  });
});
