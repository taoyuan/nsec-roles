'use strict';

const PromiseA = require('bluebird');
const joi = require('joi');
const arrify = require('arrify');
const _ = require('lodash');

const sv = require('./sv');
const modeler = require('./modeler');

class Rolein {

	/**
	 *
	 * @param opts
	 */
	constructor(opts) {
		opts = opts || {};
		if (opts.models) {
			this.models = opts.models;
		} else {
			this.models = modeler.load(opts);
		}

		this._scope = opts.scope;

		this.Role = this.models.RinRole;
		this.RoleMapping = this.models.RinRoleMapping;
	}

	/**
	 *
	 * @param {String} [scope]
	 * @return {Rolein}
	 */
	scoped(scope) {
		scope = scope || null;
		return new Rolein({models: this.models, scope});
	}

	get scope() {
		return this._scope;
	}

	get isScoped() {
		return !_.isUndefined(this._scope);
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

	inherit(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		return PromiseA.resolve(typeof role === 'string' ? this.Role.findById(role) : role)
			.then(role => role.inherit(parents));
	}

	uninherit(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		return PromiseA.resolve(typeof role === 'string' ? this.Role.findById(role) : role)
			.then(role => role.uninherit(parents));
	}

	setInherits(role, parents) {
		joi.assert(role, sv.ArgRole);
		joi.assert(parents, sv.ArgRoles);

		return PromiseA.resolve(typeof role === 'string' ? this.Role.findById(role) : role)
			.then(role => role.setInherits(parents));
	}

	/**
	 * Resolve roles or role ids to role instances
	 * @param roles
	 */
	resolve(roles) {
		return this.Role.resolve(roles, this.scope);
	}

	getParentIds(roles) {
		return this.resolve(roles).map(role => role.parentIds).then(_.flatten).then(_.uniq);
	}

	getParents(roles) {
		return this.getParentIds(roles).then(ids => this.resolve(ids));
	}

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

	assign(roles, users) {
		roles = this.resolve(roles);
		users = arrify(users).map(u => normalize(u)).filter(_.identity);

		// resolve and filter roles according scope
		return PromiseA.all([roles, users]).then(([roles, users]) => {
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

	unassign(roles, users) {
		// resolve and filter roles according scope
		if (roles !== '*') {
			roles = this.resolve(roles).map(role => role.id);
		}
		if (users !== '*') {
			users = arrify(users).map(u => normalize(u)).filter(_.identity);
		}

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

	findRolesByUsers(users) {
		users = arrify(users).map(u => normalize(u)).filter(_.identity);
		return this.RoleMapping.find({where: {scope: this.scope, userId: {inq: users}}});
	}

	findUsersByRoles(roles) {
		return this.resolve(roles).map(role => role.id).then(roles => {
			return this.RoleMapping.find({where: {scope: this.scope, roleId: {inq: roles}}});
		});
	}

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

module.exports = Rolein;

function normalize(target, prop) {
	prop = prop || 'id';
	target = target || '';
	return _.isString(target) ? target : target[prop];
}