/* eslint-disable object-curly-newline */
// todo add, modified and remove permission of a section
/* eslint-disable class-methods-use-this */

const { request } = require('../helper/');

const uri = 'sections';

const link = id => `${uri}/${id}/permissions`;

class Permission {
	constructor(options) {
		this.options = options || {};
		// this.docs = {};
	}

	/**
	 * @param read Can read a section.
	 * @param write Can edit a section, but can not modified the structure. Example: student answer a question.
	 * @param create Can edit a section structure. Example: teacher can create and edit new answers.
	 * @example {read:false, write:true, create:true}
	 * 			will allow you create new answers AND edit this answers. Read is override by the higher permissions.
	 */
	create({ group, read, write, create }, params) {
		return request(link(params.sectionId), params, {
			data: { group, read, write, create },
		});
	}

	/**
	 * If any value it not set, it is mapped to false.
	 */
	patch(permissionId, { read = false, write = false, create = false }, params) {
		return request(link(params.sectionId), params, {
			data: { read, write, create },
		});
	}

	remove(permissionId, params) {
		return request(link(params.sectionId), params);
	}

	setup(app) {
		this.app = app;
	}
}

module.exports = Permission;
