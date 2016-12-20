'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');
const s = require('./support');

describe('rolein/scoped', () => {
	const rin = s.createRolein();

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			rin.scoped().add('member'),
			rin.scoped('org:1').add('member'),
			rin.scoped('team:1').add('member')
		]);
	}

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return rin.find({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => rin.count({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => rin.scoped().count({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rin.scoped('org:1').count({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rin.scoped('team:1').count({name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => rin.scoped().remove('member'))
			.then(() => rin.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.scoped('org:1').remove('member'))
			.then(() => rin.scoped('org:1').count({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.scoped('team:1').remove('member'))
			.then(() => rin.scoped('team:1').count({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.count({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});
});
