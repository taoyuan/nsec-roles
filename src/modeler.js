'use strict';

const _ = require('lodash');
const path = require('path');
const needs = require('needs');
const DataSource = require('loopback-datasource-juggler').DataSource;

/**
 *
 * @param options
 * @return {{}}
 */
exports.load = function (options) {
	options = Object.assign({
		modelsDir: path.resolve(__dirname, '../common/models'),
		defaultModelSettings: {}
	}, options);

	let dataSource = options.dataSource || options.datasource || options.ds;
	if (dataSource === 'string') {
		dataSource = {connector: dataSource};
	}
	if (!dataSource) {
		dataSource = {connector: 'memory'};
	}
	if (!_.isObject(dataSource) || !_.isFunction(dataSource.createModel)) {
		dataSource = new DataSource(dataSource);
	}

	const definitions = needs(options.modelsDir, {includes: '*.json'});
	const customizes = needs(options.modelsDir, {includes: '*.js'});

	const models = {};

	_.forEach(definitions, def => {
		models[def.name] = dataSource.createModel(def.name, def.properties,
			_.defaults(_.omit(def, ['name', 'properties']), options.defaultModelSettings)
		);
	});

	_.forEach(definitions, (def, filename) => {
		if (_.isFunction(customizes[filename])) {
			customizes[filename](models[def.name]);
		}
	});

	return models;
};
