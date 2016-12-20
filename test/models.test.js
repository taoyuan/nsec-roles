'use strict';

const assert = require('chai').assert;
const modeler = require('../src/modeler');
const s = require('./support');

describe('models', () => {
	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	it('should load models', () => {
		const models = modeler.load();
		assert.isFunction(models.SecRole);
		assert.isFunction(models.SecRoleMapping);
	});

	it('should create role mapping', () => {
		const {SecRoleMapping} = s.models;
		return SecRoleMapping.create({
			roleId: 'abc', userId: 'Tome', scope: 'org1'
		}).then(mapping => {
			return SecRoleMapping.find().then(mappings => {
				assert.lengthOf(mappings, 1);
				assert.deepEqual(mappings[0].toObject(), mapping.toObject());
			});
		});
	});
});
