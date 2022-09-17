/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import {mergeResolvers, mergeTypeDefs} from "@graphql-tools/merge";
import {gql} from "apollo-server-core";
import {ApolloServer} from "apollo-server-express";
import {ControlledError, Errors, isControlledError} from "bridge";
import MongoStore from "connect-mongo";
import {ServerBoilerplate} from "express-server-boilerplate";
import session from "express-session";
import {GraphQLUpload, graphqlUploadExpress} from "graphql-upload";
import {config} from "../config";

export async function startServer() {
	const server = new ServerBoilerplate();

	server.cors({
		origin: [
			config.FRONTEND_URL,
			config.DEVELOPMENT && "https://studio.apollographql.com"
		],
		credentials: true
	});

	// Express session
	server.handler(app => {
		app.use(session({
			secret: config.SESSION_SECRET,
			resave: true,
			saveUninitialized: true,
			name: 'auth.id',
			cookie: {
				secure: config.PRODUCTION,
				domain: config.COOKIE_DOMAIN
			},
			store: MongoStore.create({
				mongoUrl: config.MONGODB_URI
			})
		}));
	});

	// Error handler
	server.errorHandler((err, req, res, next) => {
		if (res.headersSent)
			return next(err);

		// We can expose if it's a controlled error
		if (isControlledError(err)) {
			// Print controlled errors if we're in development
			if (config.DEVELOPMENT) {
				console.log(err);
			}

			const castedErr: ControlledError = err;
			return res.status(castedErr.error_status).json(castedErr.body);
		}

		// Otherwise, assume it's internal
		else {
			console.log(err);
			return res.status(500).json(Errors.internal_error().body)
		}
	});

	// Configure the server
	const apolloServer = new ApolloServer({
		typeDefs: mergeTypeDefs([
			gql`scalar Upload`
		]),
		resolvers: mergeResolvers([
			{Upload: GraphQLUpload}
		]),
		csrfPrevention: true,
		context: async ({req}) => {
			return {
				session: req.session
			}
		},
		formatError: (error) => {
			const originalError = error.originalError;
			console.log(error)

			// Internal error
			if (error.extensions.code === "INTERNAL_SERVER_ERROR") {
				console.log(originalError);
				return Errors.internal_error();
			}

			// Handle a Controlled Error
			else if (isControlledError(originalError)) {
				if (config.DEVELOPMENT) {
					console.log(originalError);
				}

				return error;
			}

			// Other type of error—throw an internal error
			else {
				return Errors.internal_error();
			}
		},
		debug: config.DEVELOPMENT,
	});

	// Enable the Apollo server
	await apolloServer.start();

	// GraphQL Upload
	server.handler(app => {
		app.use(graphqlUploadExpress({
			// maxFileSize: 10000000 * 20,
			maxFiles: 1,
		}));
	})

	// Apply Apollo Server
	server.handler(async app => {
		apolloServer.applyMiddleware({
			app,
			cors: false,
			path: '/graphql'
		});
	});

	await server.start(config.PORT);
	console.log('Express => PORT:' + config.PORT);
}

