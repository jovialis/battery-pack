/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import {config as loadEnv} from "dotenv";

// Load .env file if we're not in production
if (process.env.NODE_ENV !== "production") {
	loadEnv();
}

export const config = {
	DEVELOPMENT: process.env.NODE_ENV !== "production",
	PRODUCTION: process.env.NODE_ENV === "production",

	PORT: process.env.PORT || "8080",

	FRONTEND_URL: process.env.FRONTEND_URL,
	SESSION_SECRET: process.env.SESSION_SECRET,
	COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,

	MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/batterypack"
}