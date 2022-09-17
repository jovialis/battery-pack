/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

export type ErrorGeneratorMap = { [key: string]: ErrorTemplateGenerator }

export function createError(status: number, id: string, explanation: string): ErrorTemplateGenerator {
	const generator: ErrorTemplateGenerator = <ErrorTemplateGenerator>errorBodyGenerator(status, id, explanation);
	generator.id = id;
	generator.description = explanation;
	generator.status = status;
	return generator;
}

/**
 * Results of an Instantiated Error
 */
interface ErrorBody {
	id: string
	status: number
	description: string
}

type ErrorTemplateGenerator = ((args?: string[]) => ControlledError) & ErrorBody;

/**
 * Error body generator
 * @param status
 * @param id
 * @param explanation
 * @constructor
 */
function errorBodyGenerator(status: number, id: string, explanation: string) {
	return (args?: string[]): ControlledError => {
		let i = 0;
		while (args && explanation.includes("{}") && i < args.length) {
			explanation = explanation.replace("{}", args[i]);
			i++;
		}
		return new ControlledError(status, id, explanation);
	}
}

export class ControlledError extends Error {
	public readonly error_status: number
	public readonly error_id: string
	public readonly error_description: string

	public readonly body: ErrorBody

	constructor(status: number, id: string, description: string) {
		super(id);

		this.error_status = status;
		this.error_id = id;
		this.error_description = description;

		this.body = {
			status: status,
			id: id,
			description: description
		};
	}

	public isControlledError() {
		return true;
	}

	public override toString() {
		return `${this.error_id}: ${this.error_description}`;
	}
}

export function isControlledError(error: any | Error): error is ControlledError {
	return (<ControlledError>error).isControlledError !== undefined;
}

export function isErrorType(error_id: string, errorTemplate: ErrorTemplateGenerator) {
	return errorTemplate.id === error_id;
}