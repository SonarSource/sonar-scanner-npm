const assert = require('assert');
const utils = require('../src/utils');
const sinon = require('sinon');


describe('findTargetOS()', function () {
  it('detect Windows', function () {
    const stub = sinon.stub(process, 'platform').value('windows10');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'windows');
    stub.restore();
  });

  it('detect Mac', function () {
    const stub = sinon.stub(process, 'platform').value('darwin');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'macosx');
    stub.restore();
  });

  it('detect Linux', function () {
    const stub = sinon.stub(process, 'platform').value('linux');
    stub.returns(true);

    assert.equal(utils.findTargetOS(), 'linux');
    stub.restore();
  });
});
