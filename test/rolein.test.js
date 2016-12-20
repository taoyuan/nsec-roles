'use strict';

const assert = require('chai').assert;
const _ = require('lodash');
const Promise = require('bluebird');
const s = require('./support');

describe('rolein', () => {
	const rin = s.createRolein();

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			rin.add({scope: null, name: 'member'}),
			rin.add({scope: 'org:1', name: 'member'}),
			rin.add({scope: 'team:1', name: 'member'})
		]);
	}

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return rin.find({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => rin.count({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => rin.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rin.count({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => rin.count({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => rin.remove({scope: null, name: 'member'}))
			.then(() => rin.count({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.remove({scope: 'org:1', name: 'member'}))
			.then(() => rin.count({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.remove({scope: 'team:1', name: 'member'}))
			.then(() => rin.count({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => rin.count({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});

	it('should inherits from parents', () => {
		const scoped = rin.scoped();
		return Promise.all([
			scoped.add('member'),
			scoped.add('leader'),
			scoped.add('admin')
		]).then(([member, leader, admin]) => {
			return rin.inherit(admin, member)
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id]);
				})
				.then(() => rin.inherit(admin, leader))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				})
				.then(() => rin.uninherit(admin, member))
				.then(role => {
					assert.sameMembers(role.parentIds, [leader.id]);
				})
				.then(() => rin.setInherits(admin, [admin, member, leader]))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				});
		});
	});

	it('should get roles parents', () => {
		return createInheritedRoles(rin.scoped()).then(([A, B, C, D, ABC, BCD]) => {
			return rin.getParents([ABC, BCD]).then(parents => {
				assert.sameDeepMembers(parents.map(p => p.name), ['A', 'B', 'C', 'D']);
			});
		});
	});

	it('should recurse parents ', () => {
		return createInheritedRoles(rin.scoped()).then(([A, B, C, D, ABC, BCD, ABCD]) => {
			return rin.recurseParentIds(ABCD).then(parentIds => {
				assert.sameDeepMembers(parentIds, [A, B, C, D, ABC, BCD].map(r => r.id));
			});
		});
	});

	it('should assign user roles', () => {
		const scoped = rin.scoped('123');
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
		const scoped = rin.scoped('123');
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
		const X = rin.scoped('X');
		const Y = rin.scoped('Y');
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
				return X.findUserRoles('Tom').then(roles => {
					assert.lengthOf(roles, 2);
					assert.sameDeepMembers(roles, [XA.id, XB.id]);
				});
			});
		});
	});

	it('should find roles recursively by users', () => {
		const X = rin.scoped('X');
		const Y = rin.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC, XD, XABC], [YA, YB, YC]]) => {
			return Promise.all([
				X.assign(XA, ['Tom', 'Jerry']),
				X.assign(XB, ['Tom', 'Dean', 'Sam']),
				X.assign(XC, ['Merlin']),
				X.assign(XABC, ['Merlin']),
				Y.assign(YA, ['Tom', 'Jerry']),
				Y.assign(YB, ['Tom', 'Dean', 'Sam']),
				Y.assign(YC, ['Merlin'])
			]).then(() => {
				return X.findUserRoles('Merlin', true).then(roles => {
					assert.lengthOf(roles, 4);
					assert.sameDeepMembers(roles, [XA.id, XB.id, XC.id, XABC.id]);
				});
			});
		});
	});

	it('should find users by roles', () => {
		const X = rin.scoped('X');
		const Y = rin.scoped('Y');
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
				return X.findRoleUsers(XB).then(users => {
					assert.lengthOf(users, 3);
					assert.sameDeepMembers(users, ['Tom', 'Dean', 'Sam']);
				});
			});
		});
	});

	it('should has roles with role id', () => {
		const X = rin.scoped('X');
		const Y = rin.scoped('Y');
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
		const X = rin.scoped('X');
		const Y = rin.scoped('Y');
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
