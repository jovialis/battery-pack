/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import {ControlledError, createError, ErrorGeneratorMap, isControlledError, isErrorType} from "./errors";

export {isControlledError, isErrorType, ControlledError};

export const Errors: ErrorGeneratorMap = {
	internal_error: createError(500, "internal_error", "Uh oh. Something went wrong on our end. Please try again."),
}

/**
 * YOUR TYPE HERE
 */

