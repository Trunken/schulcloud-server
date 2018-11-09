'use strict';

const service = require('feathers-mongoose');
const errors = require('feathers-errors');
const { teamsModel } = require('./model');
const hooks = require('./hooks');
const logger = require('winston');
//const {teamRolesToHook} = require('./hooks');
//todo docs require 

const getUpdatedSchoolIdArray = (team, user) => {
	let schoolIds = team.schoolIds;
	const userSchoolId = user.schoolId;

	if (schoolIds.includes(userSchoolId) === false)
		schoolIds.push(userSchoolId);

	return schoolIds;
};

class Get {
	constructor(options) {
		this.options = options || {};
		this.docs = {};
		//this.app = options.app;
	}
	/**
	 * 
	 * @param {*} params 
	 */
	find(params) {
		const teamsService = this.app.service('teams');
		const usersService = this.app.service('users');

		const userId = ((params.account || {}).userId || {}).toString();
		return usersService.get(userId).then(_user => {
			const email = _user.email;
			const restrictedFindMatch = { invitedUserIds: { $elemMatch: { email } } };
			return teamsService.find({ query: restrictedFindMatch });
		}).catch(err => {
			logger.warn(err);
			throw new errors.NotFound('User do not exist.');
		});
	}

	setup(app, path) {
		this.app = app;
	}
}

/**
 * @attantion Please send no feedback if user is not found!
 */
class Add {
	constructor(options) {
		this.options = options || {};
		this.docs = {};
		//this.app = options.app;
	}

	/**
	 * 
	 * @param {*} id 
	 * @param {*} data 
	 * @param {*} params 
	 */
	patch(id, data, params) {
		const teamsService = this.app.service('teams');
		const usersService = this.app.service('users');
		const email = data.email;
		const userId = data.userId;
		let role = data.role;
		const teamId = id;

		const errorHandling = err => {
			logger.warn(err);
			return Promise.resolve('Success!');
		};

		if (['teamexpert', 'teamadministrator'].includes(role) === false) {
			return errorHandling('Wrong role is set.');
		}

		if (email && role) {
			return teamsService.get(teamId)
				.then(_team => {
					let invitedUserIds = _team.invitedUserIds;
					invitedUserIds.push({ email, role });

					return teamsService.patch(teamId, { invitedUserIds }, params)
						.then(_patchedTeam => {
							return Promise.resolve('Success!');
						})
						.catch(errorHandling);
				}).catch(errorHandling);
		} else if (userId && role) {
			return usersService.get(userId)
				.then(_user => {
					return teamsService.get(teamId).then(_team => {
						let userIds = _team.userIds;
						return hooks.teamRolesToHook(this).then(_self => {
							role = _self.findRole('name', role, '_id');
							userIds.push({ userId, role });
							const schoolIds = getUpdatedSchoolIdArray(_team, _user);
							return teamsService.patch(teamId, { userIds,schoolIds }, params).catch(errorHandling);
						}).catch(errorHandling);
					}).catch(errorHandling);
				}).catch(errorHandling);
		} else {
			throw new errors.BadRequest('Missing input data.');
		}
	}

	setup(app, path) {
		this.app = app;
	}
}
//todo accept and add user is same => add to function .only modified invitedUserIds is different
/**
 * Accept the team invite
 */
class Accept {
	constructor(options) {
		this.options = options || {};
		this.docs = {};
		//	this.app = options.app;
	}
	/**
	 * 
	 * @param {*} id 
	 * @param {*} params 
	 */
	get(id, params) {
		const teamId = id;
		const userId = ((params.account || {}).userId || {}).toString();
		const teamsService = this.app.service('teams');
		const usersService = this.app.service('users');

		return usersService.get(userId).then(_user => {
			const email = _user.email;
			return teamsService.get(teamId).then(_team => {
				let invitedUserIds = _team.invitedUserIds;
				let userIds = _team.userIds;

				const invitedUser = invitedUserIds.find(element => element.email === email);
				if (invitedUser === undefined)
					throw new errors.NotFound('User is not in this team.');

				return hooks.teamRolesToHook(this).then(_self => {
					const role = _self.findRole('name', invitedUser.role, '_id');
					userIds.push({ userId, role });

					invitedUserIds = invitedUserIds.reduce((stack, element) => {
						if (element.email !== email)
							stack.push(element);
						return stack;
					}, []);

					const schoolIds = getUpdatedSchoolIdArray(_team, _user);

					return teamsService.patch(teamId, { invitedUserIds, userIds, schoolIds }, params).catch(err => {
						throw new errors.Conflict('Can not patch team with changes.', err);
					});
				});
			}).catch(err => {
				throw new errors.NotFound('Can not take the team.', err);
			});
		}).catch(err => {
			logger.warn(err);
			throw new errors.Forbidden('You have not the permission to do this.');
		});
	}

	setup(app, path) {
		this.app = app;
	}
}

/**
 * Remove from invite list
 */
class Remove {
	constructor(options) {
		this.options = options || {};
		this.docs = {};
		//	this.app = options.app;
	}
	/**
	 * 
	 * @param {*} id 
	 * @param {*} data 
	 * @param {*} params 
	 */
	patch(id, data, params) {
		const teamId = id;
		const teamsService = this.app.service('teams');
		const email = data.email;

		return teamsService.get(teamId).then(_team => {
			let invitedUserIds = _team.invitedUserIds.reduce((stack, element) => {
				if (element.email !== email)
					stack.push(element);
				return stack;
			}, []);

			return teamsService.patch(teamId, { invitedUserIds }, params).catch(err => {
				throw new errors.Conflict('Can not patch team with changes.', err);
			});
		}).catch(err => {
			logger.warn(err);
			throw new errors.NotFound('No team found.');
		});
		//remove user from inv list
	}

	setup(app, path) {
		this.app = app;
	}
}

module.exports = function () {
	const app = this;
	const options = {
		Model: teamsModel,
		paginate: {
			default: 10,
			max: 100
		},
		lean: true
	};

	app.use('/teams', service(options));
	app.use('/teams/extern/get', new Get());
	app.use('/teams/extern/add', new Add());
	app.use('/teams/extern/accept', new Accept());
	app.use('/teams/extern/remove', new Remove());

	const teamsServices = app.service('/teams');
	const topLevelServices = {
		get: app.service('/teams/extern/get'),
		add: app.service('/teams/extern/add'),
		accept: app.service('/teams/extern/accept'),
		remove: app.service('/teams/extern/remove')
	};

	teamsServices.before(hooks.before);
	teamsServices.after(hooks.after);

	Object.values(topLevelServices).forEach(_service => {
		_service.before(hooks.beforeExtern);
		_service.after(hooks.afterExtern);
	});
};