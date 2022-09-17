/**
 * Created by jovialis (Dylan Hanson) on 9/5/22.
 */

export function def<D>(val: D | undefined, defaultValue: D): D {
	if (val === undefined) {
		return defaultValue;
	}
	return val;
}