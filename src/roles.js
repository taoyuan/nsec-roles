'use strict';

const PromiseA = require('bluebird');
const joi = require('joi');
const arrify = require('arrify');
const _ = require('lodash');

const sv = require('./sv');
const modeler = require('./modeler');
const utils = require('./utils');

class Roles {
	/**
	 * Create Rolein instance
	 *
	 * @param {String|Object} [ds]
	 * @param {Object} [opts]
	 * @param {Object} [opts.models]
	 * @param {String} [opts.scope]
	 * @param {String} [opts.modelsDir]
	 * @param {Object} [opts.defaultModelSettings]
	 * @param {Object|String} [opts.dataSource]
	 * @param {Object|String} [opts.datasource]
	 * @param {Object|String} [opts.ds]
	 */
	constructor(ds, opts) {
		if (!_.isString(ds) && !_.isFunction(_.get(ds, 'createModel'))) {
			opts = ds;
			ds = undefined;
		}
		opts = _.defaults(opts || {}, {ds});

		if (opts.models) {
			this._models = opts.models;
		} else {
			this._models = modeler.load(opts);
		}

		this._scope = opts.scope;

		this.Role = this._models.SecRole;
		this.RoleMapping = this._models.SecRoleMapping;
	}

	get scope() {
		return this._scope;
	}

	get isScoped() {
		return !_.isUndefined(this._scope);
	}

	/**
	 *
	 * @param {*} [scope]
	 * @return {Roles}
	 */
	scoped(scope) {
		if (scope) {
			scope = _.flatten(_.map(arguments, arg => utils.identify(arg))).filter(_.identity).join(':');
		} else {
			scope = null;
		}

		return new Roles({models: this._models, scope});
	}

	//----------------------------------------------
	// Basic CRUD
	//----------------------------------------------

	/**
	 * Find roles with filter
	 *
	 * @param {Object} [filter]
	 * @param {Object} [options]
	 * @return {*}
	 */
	find(filter, options) {
		joi.assert(filter, sv.Filter);

		if (this.isScoped) {
			const where = {scope: this._scope};
			filter = filter || {};
			filter.where = filter.where ? {and: [filter.where, where]} : where;
		}

		return this.Role.find(filter, options);
	}

	/**
	 * Count for roles
	 *
	 * @param {Object} [where] where object
	 * @param {Object} [options]
	 */
	count(where, options) {
		joi.assert(where, joi.object().allow(null), 'where');

		if (this.isScoped) {
			where = Object.assign({}, where, {scope: this._scope});
		}
		return this.Role.count(where, options);
	}

	/**
	 * Remove roles by where object or name|id for scoped mode
	 *
	 * @param {Object|String} [where] where object or name|id for scoped remove
	 * @param {Object} [options]
	 * @return {*}
	 */
	remove(where, options) {
		if (this.isScoped) {
			joi.assert(where, sv.ArgStrObj.allow(null));
			if (_.isString(where)) {
				where = {or: [{name: where}, {id: where}]};
			}
			where = Object.assign({scope: this._scope}, where);
		} else {
			joi.assert(where, joi.object().allow(null));
		}
		return this.Role.find({where, fields: ['id']}).then(ids => {
			if (_.isEmpty(ids)) {
				return {count: 0};
			}
			// TODO transaction ?
			return PromiseA.resolve()
			// Remove all related mappings
				.then(() => this.RoleMapping.destroyAll({roleId: {inq: ids}}))
				.then(() => this.Role.destroyAll(where, options));
		});
	}

	/**
	 * Add role
	 *
	 * @param {Object|String} data Role data object or name for scoped mode
	 * @return {Bluebird<U>|*|Bluebird<U2|U1>|Bluebird<R>|Thenable<U>}
	 */
	add(data) {
		if (this.isScoped) {
			joi.assert(data, sv.ArgStrObj);
			if (_.isString(data)) {
				data = {name: data};
			}
			data = Object.assign({scope: this._scope}, data);
		} else {
			joi.assert(data, sv.RoleData);
		}
		return PromiseA.resolve(this.Role.findOrCreate({where: data}, data).then(info => info[0]));
	}

	//----------------------------------------------
	// Inherits and Parents
	//----------------------------------------------

	/**
	 * Inherit role from parent roles
	 *
	 * @param {Role|String} role
	 * @param {[String]} parents
	 * @return {Promise.<Role>}
	 */
	inherit(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		const promise = _.isString(role) ? this.Role.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.inherit(parents));
	}

	/**
	 * Uninherit role's parents
	 *
	 * @param {Role|String} role
	 * @param {[String]} parents
	 * @return {Promise.<Role>}
	 */
	uninherit(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		const promise = _.isString(role) ? this.Role.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.uninherit(parents));
	}

	/**
	 * Set parents to role's inherits
	 *
	 * @param {Role|String} role
	 * @param {[String]} parents
	 * @return {Promise.<Role>}
	 */
	setInherits(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		const promise = _.isString(role) ? this.Role.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.setInherits(parents));
	}

	/**
	 * Resolve roles or role ids to role instances
	 * @param {Role|String|[Role]|[String]} roles
	 * @return {Promise.<[Role]>}
	 */
	resolve(roles) {
		return this.Role.resolve(roles, this.scope);
	}

	/**
	 * Get first level parent role ids for roles specified
	 *
	 * @param {Role|String|[Role]|[String]} roles
	 * @return {Promise.<[String]>}
	 */
	getParentIds(roles) {
		return this.resolve(roles).map(role => role.parentIds).then(_.flatten).then(_.uniq);
	}

	/**
	 * Get first level parent role objects for the roles specified
	 *
	 * @param {Role|String|[Role]|[String]} roles
	 * @return {Promise.<[Role]>}
	 */
	getParents(roles) {
		return this.getParentIds(roles).then(ids => this.resolve(ids));
	}

	/**
	 * Recurse get all parent role ids for the roles specified
	 *
	 * @param {Role|String|[Role]|[String]} roles
	 * @return {Promise.<[String]>}
	 */
	recurseParentIds(roles) {
		const recurse = (roles, answer = []) => {
			return this.getParentIds(roles)
			// exclude resolved role to avoid cycle parent reference
				.then(parentIds => _.filter(parentIds, id => !answer.includes(id)))
				.then(parentIds => {
					if (_.isEmpty(parentIds)) {
						return answer;
					}
					answer.push(...parentIds);
					return recurse(parentIds, answer);
				});
		};

		return recurse(roles);
	}

	//----------------------------------------------
	// Role Mappings
	//----------------------------------------------

	/**
	 * Assign roles to users
	 *
	 * @param {Role|String|[Role]|[String]} roles
	 * @param {String|[String]} users
	 * @return {Promise.<[RoleMapping]>}
	 */
	assign(roles, users) {
		const proles = this.resolve(roles);
		users = arrify(users).map(u => normalize(u)).filter(_.identity);

		// resolve and filter roles according scope
		// noinspection JSValidateTypes
		return PromiseA.all([proles, users]).then(([roles, users]) => {
			if (_.isEmpty(roles) || _.isEmpty(users)) return PromiseA.resolve([]);

			const items = _.flatten(_.map(roles, role => _.map(users, userId => ({
				userId,
				roleId: role.id,
				scope: role.scope
			}))));

			if (_.isEmpty(items)) {
				return PromiseA.resolve([]);
			}
			return PromiseA.fromCallback(cb => this.RoleMapping.create(items, cb));
		});
	}

	/**
	 * Unassign roles with users
	 *
	 * @param {Role|String|[Role]|[String]} roles
	 * @param {String|[String]} users
	 * @return {{count: Number}}
	 */
	unassign(roles, users) {
		// resolve and filter roles according scope
		if (roles !== '*') {
			roles = this.resolve(roles).map(role => role.id);
		}
		if (users !== '*') {
			users = arrify(users).map(u => normalize(u)).filter(_.identity);
		}

		// noinspection JSValidateTypes
		return PromiseA.all([roles, users]).then(([roles, users]) => {
			const where = {scope: this.scope};
			if (roles !== '*' && !_.isEmpty(users)) {
				where.roleId = {inq: roles};
			}
			if (users !== '*' && !_.isEmpty(users)) {
				where.userId = {inq: users};
			}

			return PromiseA.fromCallback(cb => this.RoleMapping.destroyAll(where, cb));
		});
	}

	/**
	 * Find user roles with user id
	 *
	 * @param {String|[String]} user User id
	 * @param {Boolean} [recursively]
	 * @return {Promise.<[String]>}
	 */
	findUserRoles(user, recursively) {
		user = arrify(user).map(u => normalize(u)).filter(_.identity);
		const where = {scope: this.scope, userId: {inq: user}};
		const promise = PromiseA.fromCallback(cb => this.RoleMapping.find({where}, cb))
			.map(m => m.roleId).then(_.uniq);
		if (recursively) {
			// noinspection JSValidateTypes
			return promise.then(roleIds => this.recurseParentIds(roleIds).then(parentIds => _.union(roleIds, parentIds)));
		}
		// noinspection JSValidateTypes
		return promise;
	}

	/**
	 * Find role users with role id
	 *
	 * @param {Role|String|[Role]|[String]} role
	 * @return {Promise.<[String]>}
	 */
	findRoleUsers(role) {
		return this.resolve(role).map(role => role.id).then(roles => {
			const where = {scope: this.scope, roleId: {inq: roles}};
			return PromiseA.fromCallback(cb => this.RoleMapping.find({where}, cb))
				.map(m => m.userId).then(_.uniq);
		});
	}

	/**
	 *
	 * @param {String} user
	 * @param {Role|String|[Role]|[String]} roles
	 * @return {Promise.<Boolean>}
	 */
	hasRoles(user, roles) {
		user = normalize(user);
		return this.resolve(roles).map(role => role.id).then(roles => {
			if (!user || _.isEmpty(roles)) {
				return PromiseA.resolve(false);
			}
			return this.RoleMapping.count({
				scope: this.scope,
				userId: user,
				roleId: {inq: roles}
			}).then(c => c === roles.length);
		});
	}
}

module.exports = Roles;

function normalize(target, prop) {
	prop = prop || 'id';
	target = target || '';
	return _.isString(target) ? target : target[prop];
}
