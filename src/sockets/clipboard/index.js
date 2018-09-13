'use strict';

const socketio = require('feathers-socketio');
const siofu = require("socketio-file-upload");
const logger = require('winston');
const path = require("path");

module.exports = function () {
	const app = this;
	var courses = {};
	app.use(siofu.router);
	app.configure(socketio((io) => {

		let clipboardWs = io.of('clipboard');
		clipboardWs.on('connection', (socket) => {

			let courseId = socket.request._query.courseId;

			if(!courseId) return;
			logger.debug("someone connected to room " + courseId);
			socket.join(courseId);

			if(!courses[courseId]) courses[courseId] = {
				media: [],
				users: {},
				board: {},
				lastId: 0
			};
			let course = courses[courseId];
			socket.emit("clipboardState", course); //on connect send inital state

			let user = {};
			app.service('users').get(socket.client.userId).then((result) => { 
				user = result;
				course.users[user._id] = user;
				socket.nsp.to(courseId).emit("clipboardState", course);
			});

			socket.on("ADD_MEDIA", (media) => {
				media.id = ++course.lastId;
				course.media.push(media);
				socket.nsp.to(courseId).emit("clipboardState", course);
			});

			socket.on("ADD_TO_BOARD", (media) => {
				course.board[media.id] = media;
				socket.nsp.to(courseId).emit("clipboardState", course);
			});

			socket.on("UPDATE_MEDIA_ON_BOARD", (media) => {
				course.board[media.id] = media;
				socket.nsp.to(courseId).emit("clipboardState", course);
			});

			initUploadSocket(socket, (filename) => {
				let file = {
					file: filename,
					sender: user && (user.firstName + " " + user.lastName),
					type: "image",
					id: ++course.lastId,
				};
				course.media.push(file);
				socket.nsp.to(courseId).emit("clipboardState", course);
			});
		});
	}));

	function initUploadSocket(socket, onUpload) {
		var uploader = new siofu();
			uploader.dir = "uploads";
			uploader.listen(socket);
			uploader.on("start", function(event){
				logger.debug("upload started " + event.file.name);
			});

			uploader.on("saved", function(event){
				onUpload(path.basename(event.file.pathName));
			});

		return uploader;
	}
};