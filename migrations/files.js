const ran = true; // set to true to exclude migration
	mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/schulcloud', { user: process.env.DB_USERNAME, pass: process.env.DB_PASSWORD });

	const oldfileModel = mongoose.model('oldfile', oldFileSchema, '_files');
	const directoryModel = mongoose.model('directory', oldDirectorySchema);
	const FileModel = mongoose.model('file', fileSchema, 'files');
