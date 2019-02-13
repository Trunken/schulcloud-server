/* eslint no-console: 0 */
/* eslint no-confusing-arrow: 0 */

const { Schema } = mongoose;
mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/schulcloud', { user: process.env.DB_USERNAME, pass: process.env.DB_PASSWORD });
const sanitizeObj = (obj) => {
	key: { type: String, required: true, unique: true },
	path: { type: String },
	name: { type: String },
	size: { type: Number },
	type: { type: String },
	flatFileName: { type: String },
	thumbnail: { type: String },
		userId: { type: Schema.Types.ObjectId, ref: 'user' },
		permissions: [{ type: String, enum: permissionTypes }],
	lockId: { type: Schema.Types.ObjectId },
	shareToken: { type: String },
	schoolId: { type: Schema.Types.ObjectId, ref: 'school' },
	studentCanEdit: { type: Boolean, default: false },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
	key: { type: String, required: true, unique: true },
	path: { type: String },
	name: { type: String },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
		refPath: 'refPermModel',
		enum: ['user', 'role'],
}, { _id: false });
		refPath: 'refOwnerModel',
		enum: ['user', 'course', 'teams'],
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
	const logGreen = (obj) => {
		if (dry) {
		const [refOwnerModel, owner,] = doc.key.split('/');
			users: 'user',
			courses: 'course',
		if (refOwnerModel === 'users') {
		if (doc.permissions && doc.permissions.length) {
			flatFileName: undefined,
		if (parent) {
			transformed = transformed.map(doc => ({ ...doc, parent }));
		const promises = transformed.map(async (d) => {
			if (dry) {
				return d;
			}
			const fileObject = await FileModel.findOne({ _id: d._id }).exec();

			if (fileObject) {
				const newId = mongoose.Types.ObjectId();
				console.log(`Remove duplicate ID ${d._id} with ${newId}`);
				d._id = newId;
			}

			return FileModel.create(d);
		});
	const rootDocument = (docs) => {
	const resolveChildren = ({ subset, documents, parent }) => spawnDocuments(subset, parent)
		.then((result) => {
				if (children.length) {
						parent: result[index]._id,
	return resolveChildren({ subset: rootDocs, documents: merged });
	run,