'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');
const s = require('./support');

describe('roles/scoped', () => {
	const rs = s.createRoles();

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			rs.scoped().add('member'),
			rs.scoped('org:1').add('member'),
			rs.scoped('team:1').add('member')
		]);
	}

	it('should scoped with all supported scope type', () => {
		let scoped = rs.scoped('123');
		assert.equal(scoped.scope, '123');
		scoped = rs.scoped(123);
		assert.equal(scoped.scope, '123');
		scoped = rs.scoped(1, 2, 3);
		assert.equal(scoped.scope, '1:2:3');
		scoped = rs.scoped('1', '2', '3');
		assert.equal(scoped.scope, '1:2:3');
		scoped = rs.scoped(new Object({id: 123}));
		assert.equal(scoped.scope, '123');
		return s.models.Store.findOne().then(store => {
			scoped = rs.scoped(store);
			assert.equal(scoped.scope, 'Store:' + store.id);
		});
	});

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return rs.find({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => rs.count({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => rs.scoped().count({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rs.scoped('org:1').count({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rs.scoped('team:1').count({name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => rs.scoped().remove('member'))
			.then(() => rs.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rs.scoped('org:1').remove('member'))
			.then(() => rs.scoped('org:1').count({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rs.scoped('team:1').remove('member'))
			.then(() => rs.scoped('team:1').count({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rs.count({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});
});
