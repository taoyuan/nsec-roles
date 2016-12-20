'use strict';

const assert = require('chai').assert;
const modeler = require('../src/modeler');
const s = require('./support');

describe('models', () => {
	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	it('should load models', () => {
		const models = modeler.load();
		assert.isFunction(models.RinRole);
		assert.isFunction(models.RinRoleMapping);
	});

	it('should create role mapping', () => {
		const {RinRoleMapping} = s.models;
		return RinRoleMapping.create({
			roleId: 'abc', userId: 'Tome', scope: 'org1'
		}).then(mapping => {
			return RinRoleMapping.find().then(mappings => {
				assert.lengthOf(mappings, 1);
				assert.deepEqual(mappings[0].toObject(), mapping.toObject());
			});
		});
	});
});
