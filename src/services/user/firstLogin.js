const errors = require('feathers-errors');
const globalHooks = require('../../hooks');

const createParent = (data, params, user, app) => app.service('/registrationPins/').find({
	query: { pin: data.pin, email: data.parent_email, verified: false },
})
	.then((check) => {
		if (!(check.data && check.data.length > 0 && check.data[0].pin === data.pin)) {
			return Promise.reject(new errors.BadRequest('Ungültige Pin, bitte überprüfe die Eingabe.'));
		}
		const parentData = {
			firstName: data.parent_firstName,
			lastName: data.parent_lastName,
			email: data.parent_email,
			children: [user._id],
			schoolId: user.schoolId,
			roles: ['parent'],
		};
		return app.service('users').create(parentData, { _additional: { asTask: 'parent' } })
			.catch((err) => {
				if (err.message.startsWith('parentCreatePatch')) {
					return Promise.resolve(err.data);
				}
				return Promise.reject(new Error('Fehler beim Erstellen des Elternaccounts.'));
			});
	});

const firstLogin = async function firstLogin(data, params, app) {
	if (data['password-1'] !== data['password-2']) {
		return Promise.reject(new errors.BadRequest('Die neuen Passwörter stimmen nicht überein.'));
	}

	const { accountId } = params.payload;
	const accountUpdate = {};
	let accountPromise = Promise.resolve();
	const userUpdate = {};
	const consentUpdate = {};
	let consentPromise = Promise.resolve();
	const user = await app.service('users').get(params.account.userId);

	if (data.parent_email) {
		await createParent(data, params, user, app)
			.then((parent) => {
				// toDo: keep old parents?
				userUpdate.parents = [parent._id];
			});
	}

	// wrong birthday object?
	if (data.studentBirthdate) {
		const dateArr = data.studentBirthdate.split('.');
		const userBirthday = new Date(`${dateArr[1]}.${dateArr[0]}.${dateArr[2]}`);
		// eslint-disable-next-line no-restricted-globals
		if (userBirthday instanceof Date && isNaN(userBirthday)) { // ToDo: enable rule
			return Promise.reject(new errors.BadRequest('Bitte einen validen Geburtstag auswählen.'));
		}
		userUpdate.birthday = userBirthday;
	}
	// malformed email?
	if (data['student-email']) {
		const regex = RegExp("^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])"
        + '?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$');
		if (!regex.test(data['student-email'])) {
			return Promise.reject(new errors.BadRequest('Bitte eine valide E-Mail-Adresse eingeben.'));
		}
		userUpdate.email = data['student-email'];
	}

	const preferences = user.preferences || {};
	preferences.firstLogin = true;
	userUpdate.preferences = preferences;

	const userPromise = app.service('users').patch(user._id, userUpdate);

	if (data.privacyConsent || data.thirdPartyConsent || data.termsOfUseConsent) {
		consentUpdate.userId = user._id;
		consentUpdate.userConsent = {
			form: 'digital',
			privacyConsent: data.privacyConsent,
			thirdPartyConsent: data.thirdPartyConsent,
			termsOfUseConsent: data.termsOfUseConsent,
		};
	}
	if (data.parent_privacyConsent || data.parent_thirdPartyConsent || data.parent_termsOfUseConsent) {
		consentUpdate.userId = user._id;
		consentUpdate.parentConsents = [{
			form: 'digital',
			privacyConsent: data.parent_privacyConsent,
			thirdPartyConsent: data.parent_thirdPartyConsent,
			termsOfUseConsent: data.parent_termsOfUseConsent,
		}];
	}
	if (consentUpdate.userId) consentPromise = app.service('consents').create(consentUpdate);

	if (data['password-1']) {
		accountUpdate.password_verification = data.password_verification;
		accountUpdate.password = data['password-1'];
		accountPromise = app.service('accounts').patch(accountId, accountUpdate, params);
	}

	return Promise.all([accountPromise, userPromise, consentPromise])
		.then(result => Promise.resolve(result))
		.catch(err => Promise.reject(err));
};

module.exports = function init(app) {
	class firstLoginService {
		create(data, params) {
			return firstLogin(data, params, app);
		}
	}

	return firstLoginService;
};
