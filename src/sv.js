const joi = require('joi');

const strobj = [joi.object(), joi.string()];
const objs = [joi.object(), joi.array().items(joi.object())];

// https://loopback.io/doc/en/lb2/Querying-data.html
exports.Filter = joi.object({
	fields: joi.alternatives().try(...strobj, joi.array().items(...strobj)),
	include: joi.alternatives().try(...strobj, joi.array().items(...strobj)),
	limit: joi.number().optional(),
	skip: joi.number().optional(),
	order: joi.string().optional(),
	where: joi.object().optional()
}).unknown();

exports.RoleData = joi.object({
	scope: joi.string().allow(null).required(),
	name: joi.string().required()
}).unknown();

exports.ArgStrObj = joi.alternatives().try(...strobj);
exports.ArgRole = joi.alternatives().try(...strobj);
exports.ArgRoles = joi.alternatives().try(...strobj, joi.array().items(...strobj));

exports.ArgObjs = joi.alternatives().try(...objs);
