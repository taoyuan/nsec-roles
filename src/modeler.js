'use strict';

const _ = require('lodash');
const path = require('path');
const needs = require('needs');
const DataSource = require('loopback-datasource-juggler').DataSource;

/**
 * Load models
 *
 * @param {Object} [opts]
 * @param {String} [opts.modelsDir]
 * @param {Object} [opts.defaultModelSettings]
 * @param {Object|String} [opts.dataSource]
 * @param {Object|String} [opts.datasource]
 * @param {Object|String} [opts.ds]
 * @return {{SecRole: Object, SecRoleMapping: Object}}
 */
exports.load = function (opts) {
	opts = Object.assign({
		modelsDir: path.resolve(__dirname, '../common/models'),
		defaultModelSettings: {}
	}, opts);

	let ds = opts.dataSource || opts.datasource || opts.ds;
	if (ds === 'string') {
		ds = {connector: ds};
	}
	if (!ds) {
		ds = {connector: 'memory'};
	}
	if (!_.isObject(ds) || !_.isFunction(ds.createModel)) {
		ds = new DataSource(ds);
	}

	const definitions = needs(opts.modelsDir, {includes: '*.json'});
	const customizes = needs(opts.modelsDir, {includes: '*.js'});

	const models = {};

	_.forEach(definitions, def => {
		models[def.name] = ds.createModel(def.name, def.properties,
			_.defaults(_.omit(def, ['name', 'properties']), opts.defaultModelSettings)
		);
	});

	_.forEach(definitions, (def, filename) => {
		if (_.isFunction(customizes[filename])) {
			customizes[filename](models[def.name]);
		}
	});

	return models;
};
