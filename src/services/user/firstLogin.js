const constants = require('../../utils/constants');

/* eslint-disable prefer-promise-reject-errors */ // fixmer this should be removed
const createParent = (data, params, user, app) => app.service('/registrationPins/')
	.find({ query: { pin: data.pin, email: data.parent_email, verified: false } })
	.then((check) => {
		if (!(check.data && check.data.length > 0 && check.data[0].pin === data.pin)) {
			return Promise.reject('Ungültige Pin, bitte überprüfe die Eingabe.');
		}
		const parentData = {
			firstName: data.parent_firstName,
			lastName: data.parent_lastName,
			email: data.parent_email,
			// eslint-disable-next-line no-underscore-dangle
			children: [user._Id],
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

const firstLogin = async (data, params, app) => {
	if (data['password-1'] !== data['password-2']) {
		return Promise.reject('Die neuen Passwörter stimmen nicht überein.');
	}

	const { accountId } = params.payload;
	const accountUpdate = {};
	let accountPromise = Promise.resolve();
	const userUpdate = {};
	// let userPromise;
	const consentUpdate = {};
	let consentPromise = Promise.resolve();
	let updateConsentUsingVersions = Promise.resolve();
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
		if (userBirthday instanceof Date && isNaN(userBirthday)) {
			return Promise.reject('Bitte einen validen Geburtstag auswählen.');
		}
		userUpdate.birthday = userBirthday;
	}
	// malformed email?
	if (data['student-email']) {
		if (!constants.expressions.email.test(data['student-email'])) {
			return Promise.reject('Bitte eine valide E-Mail-Adresse eingeben.');
		}
		userUpdate.email = data['student-email'];
	}

	const preferences = user.preferences || {};
	preferences.firstLogin = true;
	userUpdate.preferences = preferences;

	const userPromise = app.service('users').patch(user._id, userUpdate);

	if (data.privacyConsent || data.termsOfUseConsent) {
		consentUpdate.userId = user._id;
		consentUpdate.userConsent = {
			form: 'digital',
			privacyConsent: data.privacyConsent,
			termsOfUseConsent: data.termsOfUseConsent,
		};
	}

	if (data.termsOfUseConsentVersion || data.privacyConsentVersion) {
		const updateConsentDates = (consent) => {
			if (data.privacyConsentVersion) {
				consent.privacyConsent = true;
				consent.dateOfPrivacyConsent = Date.now();
			}
			if (data.termsOfUseConsentVersion) {
				consent.termsOfUseConsent = true;
				consent.dateOfTermsOfUseConsent = Date.now();
			}
			return consent;
		};

		updateConsentUsingVersions = app.service('consents').find({ userId: user._id }).then((consents) => {
			if (consents.total !== 1) {
				throw new Error('user consent not found!');
			}
			const consent = consents.data[0];
			// update userConsent if exist otherwise the parentConsent should be updated
			let updatedConsent = {
				form: 'update',
			};
			const updateConsentType = consent.userConsent ? 'userConsent' : 'parentConsents';
			if (updateConsentType === 'userConsent') {
				updatedConsent = Object.assign({}, updatedConsent, consent[updateConsentType]);
				updatedConsent = updateConsentDates(updatedConsent);
				return app.service('consents').patch(consent._id, { userConsent: updatedConsent });
			}
			if (updateConsentType === 'parentConsents' && (!consent.parentConsents || !consent.parentConsents.length)) {
				throw new Error('no parent or user consent found');
			}
			updatedConsent = Object.assign({}, updatedConsent, consent.parentConsents[0]);
			updatedConsent = updateConsentDates(updatedConsent);
			return app.service('consents').patch(consent._id, { parentConsents: [updatedConsent] });
		});
	}

	if (data.parent_privacyConsent || data.parent_termsOfUseConsent) {
		consentUpdate.userId = user._id;
		consentUpdate.parentConsents = [{
			form: 'digital',
			privacyConsent: data.parent_privacyConsent,
			termsOfUseConsent: data.parent_termsOfUseConsent,
		}];
	}
	if (consentUpdate.userId) consentPromise = app.service('consents').create(consentUpdate);

	if (data['password-1']) {
		accountUpdate.password_verification = data.password_verification;
		accountUpdate.password = data['password-1'];
		accountPromise = app.service('accounts').patch(accountId, accountUpdate, params);
	}

	return Promise.all([accountPromise, userPromise, consentPromise, updateConsentUsingVersions])
		.then(result => Promise.resolve(result))
		.catch(err => Promise.reject(err));
};

module.exports = function setup(app) {
	class firstLoginService {
		create(data, params) {
			return firstLogin(data, params, app);
		}
	}

	return firstLoginService;
};
