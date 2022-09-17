/**
 * Created by jovialis (Dylan Hanson) on 1/27/22.
 */

import {DocumentID} from "../../lib/database/utils/db";

declare module 'express-session' {
	interface SessionData {
		user: DocumentID | undefined;
	}
}