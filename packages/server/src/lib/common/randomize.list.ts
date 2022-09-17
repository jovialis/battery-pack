/**
 * Created by jovialis (Dylan Hanson) on 9/5/22.
 */

export function randomizeList<D>(list: D[]): D[] {
	return list
		.map(a => ({
			random: Math.random(),
			val: a
		}))
		.sort((x, y) => x.random - y.random)
		.map(({val}) => val);
}