// Global hooks that run for every service

const stripJs = require('strip-js');

/**
 * Strips JS Code from an object/array/string and returns clean version of it
 * @param data {object/array/string}
 * @returns data - clean without JS
 */
const stripDeepJs = (data) => {
	if (typeof data === "object") {
		for (var key in data) {
			let hasKey = data.hasOwnProperty(key);
			if(hasKey && typeof data[key] === "string") {
				data[key] = stripJs(data[key]);
			} else if (hasKey && Array.isArray(data[key])) {
				stripDeepJs(data[key]);
			} else if (hasKey && typeof data[key] === "object") {
				stripDeepJs(data[key]);
			}
		}
	} else if (typeof data === "string") {
		data = stripJs(data);
	} else if (Array.isArray(data)) {
		for (let i = 0; i < data.length; i++) {
			if (typeof data === "string") {
				data[i] = stripJs(data[i]);
			} else if (Array.isArray(data[i])) {
				stripDeepJs(data[i]);
			} else if (typeof data[i] === "object") {
				stripDeepJs(data[i]);
			}
		}
	}
	return data;
};

const stripJsUniversal = (hook) => {
	if (hook.data && hook.path && hook.path !== "authentication") {
		stripDeepJs(hook.data);
	}
	return hook;
};

module.exports = {
	before: {
		all: [],
		find: [],
		get: [],
		create: [stripJsUniversal],
		update: [stripJsUniversal],
		patch: [stripJsUniversal],
		remove: []
	},
	
	after: {
		all: [],
		find: [],
		get: [],
		create: [],
		update: [],
		patch: [],
		remove: []
	}
};