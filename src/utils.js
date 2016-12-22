'use strict';

const _ = require('lodash');

exports.identify = identify;
function identify(target, separator = ':') {
	if (_.isObject(target) && target.id) {
		if (target.constructor.modelName) {
			return target.constructor.modelName + separator + target.id;
		}
		return _.get(target, 'id');
	}
	if (target && target.toString() === '[object Object]') {
		throw new Error('Unsupported target to identify: ' + JSON.stringify(target));
	}
	return target.toString();
}

