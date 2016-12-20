'use strict';

const assert = require('chai').assert;
const _ = require('lodash');
const Promise = require('bluebird');
const s = require('./support');

describe('rolein', () => {
	const rolein = s.createRolein();

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			rolein.add({scope: null, name: 'member'}),
			rolein.add({scope: 'org:1', name: 'member'}),
			rolein.add({scope: 'team:1', name: 'member'})
		]);
	}

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return rolein.find({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => rolein.count({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => rolein.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rolein.count({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rolein.count({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => rolein.remove({scope: null, name: 'member'}))
			.then(() => rolein.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rolein.remove({scope: 'org:1', name: 'member'}))
			.then(() => rolein.count({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rolein.remove({scope: 'team:1', name: 'member'}))
			.then(() => rolein.count({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rolein.count({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});

	it('should inherits from parents', () => {
		const scoped = rolein.scoped();
		return Promise.all([
			scoped.add('member'),
			scoped.add('leader'),
			scoped.add('admin')
		]).then(([member, leader, admin]) => {
			return rolein.inherit(admin, member)
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id]);
				})
				.then(() => rolein.inherit(admin, leader))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				})
				.then(() => rolein.uninherit(admin, member))
				.then(role => {
					assert.sameMembers(role.parentIds, [leader.id]);
				})
				.then(() => rolein.setInherits(admin, [admin, member, leader]))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				});
		});
	});

	it('should get roles parents', () => {
		return createInheritedRoles(rolein.scoped()).then(([A, B, C, D, ABC, BCD]) => {
			return rolein.getParents([ABC, BCD]).then(parents => {
				assert.sameDeepMembers(parents.map(p => p.name), ['A', 'B', 'C', 'D']);
			});
		});
	});

	it('should recurse parents ', () => {
		return createInheritedRoles(rolein.scoped()).then(([A, B, C, D, ABC, BCD, ABCD]) => {
			return rolein.recurseParentIds(ABCD).then(parentIds => {
				assert.sameDeepMembers(parentIds, [A, B, C, D, ABC, BCD].map(r => r.id));
			});
		});
	});

	it('should assign user roles', () => {
		const scoped = rolein.scoped('123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assign([A, B, C], 'Tom').then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
					{roleId: A.id, scope: '123', userId: 'Tom'},
					{roleId: B.id, scope: '123', userId: 'Tom'},
					{roleId: C.id, scope: '123', userId: 'Tom'}
				]);
			});
		});
	});

	it('should unassign user roles', () => {
		const scoped = rolein.scoped('123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assign([A, B, C], 'Tom').then(() => {
				return scoped.unassign(A, 'Tom').then(info => {
					assert.deepEqual(info, {count: 1});
					return scoped.RoleMapping.find().then(mappings => {
						assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
							{roleId: B.id, scope: '123', userId: 'Tom'},
							{roleId: C.id, scope: '123', userId: 'Tom'}
						]);
					});
				});
			});
		});
	});

	it('should find roles by users', () => {
		const X = rolein.scoped('X');
		const Y = rolein.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.all([
				X.assign(XA, ['Tom', 'Jerry']),
				X.assign(XB, ['Tom', 'Dean', 'Sam']),
				X.assign(XC, ['Merlin']),
				Y.assign(YA, ['Tom', 'Jerry']),
				Y.assign(YB, ['Tom', 'Dean', 'Sam']),
				Y.assign(YC, ['Merlin'])
			]).then(() => {
				return X.findRolesByUsers('Tom').then(roles => {
					assert.lengthOf(roles, 2);
					assert.sameDeepMembers(roles.map(r => r.roleId), [XA.id, XB.id]);
				});
			});
		});
	});

	it('should find users by roles', () => {
		const X = rolein.scoped('X');
		const Y = rolein.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.all([
				X.assign(XA, ['Tom', 'Jerry']),
				X.assign(XB, ['Tom', 'Dean', 'Sam']),
				X.assign(XC, ['Merlin']),
				Y.assign(YA, ['Tom', 'Jerry']),
				Y.assign(YB, ['Tom', 'Dean', 'Sam']),
				Y.assign(YC, ['Merlin'])
			]).then(() => {
				return X.findUsersByRoles(XB).then(users => {
					assert.lengthOf(users, 3);
					assert.sameDeepMembers(users.map(r => r.userId), ['Tom', 'Dean', 'Sam']);
				});
			});
		});
	});

	it('should has roles with role id', () => {
		const X = rolein.scoped('X');
		const Y = rolein.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.all([
				X.assign(XA, ['Tom', 'Jerry']),
				X.assign(XB, ['Tom', 'Dean', 'Sam']),
				X.assign(XC, ['Merlin']),
				Y.assign(YA, ['Tom', 'Jerry']),
				Y.assign(YB, ['Tom', 'Dean', 'Sam']),
				Y.assign(YC, ['Merlin'])
			]).then(() => {
				return Promise.all([
					X.hasRoles('Tom', [XA, XB]),
					X.hasRoles('Tom', [XA, XB, XC])
				]).then(answer => {
					assert.deepEqual(answer, [true, false]);
				});
			});
		});
	});

	it('should has roles with role name', () => {
		const X = rolein.scoped('X');
		const Y = rolein.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.all([
				X.assign(XA, ['Tom', 'Jerry']),
				X.assign(XB, ['Tom', 'Dean', 'Sam']),
				X.assign(XC, ['Merlin']),
				Y.assign(YA, ['Tom', 'Jerry']),
				Y.assign(YB, ['Dean', 'Sam']),
				Y.assign(YC, ['Merlin'])
			]).then(() => {
				return Promise.all([
					X.hasRoles('Tom', ['A', 'B']),
					X.hasRoles('Tom', ['A', 'B', 'C'])
				]).then(answer => {
					assert.deepEqual(answer, [true, false]);
				});
			});
		});
	});
});

function createInheritedRoles(rolein) {
	if (!rolein.isScoped) throw new Error('require scoped roles');
	return Promise.all([
		rolein.add('A'),
		rolein.add('B'),
		rolein.add('C'),
		rolein.add('D'),
		rolein.add('ABC'),
		rolein.add('BCD'),
		rolein.add('ABCD')
	]).then(roles => {
		const [A, B, C, D, ABC, BCD, ABCD] = roles;
		return Promise.all([
			rolein.inherit(ABC, [A, B, C]),
			rolein.inherit(BCD, [B, C, D]),
			rolein.inherit(ABCD, [ABC, BCD])
		]).thenReturn(roles);
	});
}
