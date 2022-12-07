const { assert } = require('chai');
const utils = require('../src/utils');
const sinon = require('sinon');


describe('findTargetOS()', function () {
  it('detect Windows', function () {
    const stub = sinon.stub(process, 'platform').value('windows10');

    assert.equal(utils.findTargetOS(), 'windows');
    stub.restore();
  });

  it('detect Mac', function () {
    const stub = sinon.stub(process, 'platform').value('darwin');

    assert.equal(utils.findTargetOS(), 'macosx');
    stub.restore();
  });

  it('detect Linux', function () {
    const stub = sinon.stub(process, 'platform').value('linux');

    assert.equal(utils.findTargetOS(), 'linux');
    stub.restore();
  });

  it('throw if something else', function () {
    const stub = sinon.stub(process, 'platform').value('non-existing-os');

    assert.throws(utils.findTargetOS.bind(null));
    stub.restore();
  });
});
