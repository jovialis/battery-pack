/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import {startServer} from "./app";
import {connect, disconnect} from "./lib/database/utils/db";

// Connect to database
connect().then(() => {
	console.log('Connected to MongoDB');

	// Start the server
	startServer().then(() => {
		console.log('Server up and running');
	}).catch(err => {
		console.log(err);

		disconnect().then(() => {
			process.exit(1);
		});
	});
}).catch(err => {
	console.log(err);
	process.exit(0);
})

