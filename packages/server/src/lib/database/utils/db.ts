/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import Ajv, {JSONSchemaType} from "ajv";
import assert from "assert";
import {Collection, Document as MongoDocument, Filter, FindOptions, MongoClient, ObjectId} from "mongodb";
import {customAlphabet} from "nanoid";
import {config} from "../../../config";
import {Dict} from "../../common/types";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const idgen = customAlphabet(ALPHABET);

export const client = new MongoClient(config.MONGODB_URI, {
	pkFactory: {createPk: () => idgen()}
});

export async function connect() {
	await client.connect();
}

export async function disconnect() {
	await client.close();
}

export function collection(name: string) {
	return client.db().collection(name);
}

export function isDocument<I>(obj: any): obj is Document<I> {
	return !!obj && (<Document<I>>obj)._id !== undefined && (<Document<I>>obj).getCollection !== undefined;
}

export function isReference<D extends Document<DocumentInput>>(obj: any): obj is DocumentReference<D> {
	const casted = (<DocumentReference<D>>obj);
	return !!casted && casted._id !== undefined && casted.populate !== undefined;
}

export type DocumentID = ObjectId | string

export interface DocumentData {
	_id: DocumentID,
	_data: Dict
}

export interface DocumentInput {
	_id?: DocumentID
}

type DocumentTestResult = boolean | void

export class DocumentFactory<I extends DocumentInput, D extends Document<I>> {
	private readonly documentName: string;
	private readonly documentInstantiator: { new(_id: DocumentID): D }
	private readonly transformer: (map: Dict) => I;
	private readonly schema?: JSONSchemaType<I>;
	private readonly tests?: (document: D) => DocumentTestResult | Promise<DocumentTestResult>;
	private readonly debug: boolean

	constructor(
		documentName: string,
		instantiator: { new(_id: DocumentID): D },
		transformer: (map: Dict) => I,
		schema?: JSONSchemaType<I>,
		tests?: (document: D) => boolean | void,
		debug?: boolean,
	) {
		this.documentName = documentName;
		this.documentInstantiator = instantiator;
		this.transformer = transformer;
		this.schema = schema;
		this.tests = tests;
		this.debug = debug === undefined ? false : debug;
	}

	/**
	 * Builds a Document out of Map data
	 * @param dict
	 */
	public async transform(dict: Dict): Promise<D> {
		const documentData: DocumentData = <DocumentData>dict;
		const input: I = <I>documentData._data;
		input._id = documentData._id;
		this.debugPrint(`Successfully created input from map ${JSON.stringify(documentData)}`);
		return await this.build(input);
	}

	/**
	 * Creates a new Document using its input
	 * @param _id
	 * @param input
	 */
	public async build(input: I): Promise<D> {
		const instance: D = new this.documentInstantiator(input._id);
		// this.debugPrint(`Instantiated input with contents ${input}.`);

		if (this.schema) {
			const ajv = new Ajv();
			const validate = ajv.compile<I>(this.schema);
			assert(validate(input), `Invalid build: (${validate.errors})`);
		}

		// Run assertion checks if they've been passed in
		if (this.tests) {
			const res = await this.tests(instance);
			assert(res !== false, `Invalid build: (${this.documentName})`);
			this.debugPrint(`Input successfully passed tests.`);
		}

		// Instantiate the Input
		instance.instantiate(input);

		return instance;
	}

	/**
	 * Returns whether or not a given Document exists by ID
	 * @param _id
	 */
	public async existsByID(_id: DocumentID): Promise<boolean> {
		return (await this.getCollection().countDocuments({_id: _id})) > 0;
	}

	/**
	 * Returns a Document object by its ID if it exists.
	 * @param _id
	 * @param options
	 */
	public async findByID(_id: DocumentID, options?: FindOptions): Promise<D> {
		const doc = await this.getCollection().findOne({_id: _id}, options);
		assert(!!doc, `Invalid document ID: (${this.documentName}: ${_id})`);
		return await this.transform(doc);
	}

	/**
	 * Creates a Reference for a given Document
	 * @param document A Document or a DocumentID
	 * @param dummy
	 */
	public createReference(document: D | DocumentID, dummy = false): DocumentReference<D> {
		if (dummy) {
			return new DocumentReference<D>("", this); // Dummy document
		}

		if (isDocument(document)) {
			return new DocumentReference<D>(document._id, this);
		} else {
			return new DocumentReference<D>(document, this);
		}
	}

	/**
	 * Creates a Reference List for a given Document ID list
	 * @param documents
	 */
	public createReferenceList(documents: Array<D | DocumentID>, dummy = false): DocumentReferenceList<D> {
		if (dummy || !documents || documents.length === 0) {
			return new DocumentReferenceList<D>([], this);
		}

		if (isDocument(documents[0])) {
			const documentsList: D[] = <D[]>documents;
			return new DocumentReferenceList<D>(documentsList.map(d => d._id), this);
		} else {
			const documentsList: DocumentID[] = <DocumentID[]>documents;
			return new DocumentReferenceList<D>(documentsList, this);
		}
	}

	/**
	 * Exchanges an Array of References for a centralized list of references
	 * @param documents
	 */
	public exchangeReferenceArray(documents: DocumentReference<D>[]): DocumentReferenceList<D> {
		return this.createReferenceList(documents.map(d => d._id));
	}

	/**
	 * Returns the value of a Reference
	 * @param ref
	 */
	public async populateReference(ref: DocumentReference<D>): Promise<D> {
		return await this.findByID(ref._id);
	}

	/**
	 * Efficiently returns a bunch of Documents populated from a list of references.
	 * This should always return ordered.
	 * @param refs
	 */
	public async populateReferenceList(refs: DocumentReferenceList<D>): Promise<D[]> {
		const documents = await this.find({
			_id: {
				$in: refs._ids
			}
		});

		// Check whether any of the references didn't get populated
		if (documents.length !== refs.count()) {
			const failedPopulations = refs._ids.filter(ref => !documents.find(d => d._id === ref));
			assert(failedPopulations.length === 0, `Failed to load references: [${failedPopulations.join(", ")}]`)
		}

		// Store the index of all the references so we can sort them in nlogn
		let indices: { [key: string]: number } = {};
		for (let i = 0; i < refs.count(); i++) {
			indices[refs._ids[i].toString()] = i;
		}

		// Reorder them accordingly
		return documents.sort((a: D, b: D) => {
			// A comes before B,
			// A - B (0 - 5)
			return indices[a._id.toString()] - indices[b._id.toString()];
		})
	}

	/**
	 * Finds Documents using a Mongo filter. Transforms and returns them
	 * @param filter
	 * @param options
	 */
	public async remove(filter: Filter<MongoDocument> | I, options?: FindOptions<MongoDocument>): Promise<number> {
		const res = await this.getCollection().deleteMany(filter, options);
		return res.deletedCount;
	}

	/**
	 * Finds Documents using a Mongo filter. Transforms and returns them
	 * @param filter
	 * @param options
	 */
	public async find(filter: Filter<MongoDocument> | I, options?: FindOptions<MongoDocument>): Promise<D[]> {
		const res = await this.getCollection().find(filter, options);
		const docsArray = await res.toArray();
		return await Promise.all(docsArray.map(d => this.transform(d)));
	}

	/**
	 * Finds Documents using a Mongo filter. Transforms and returns them
	 * @param filter
	 * @param options
	 */
	public async findOne(filter: Filter<MongoDocument> | I, options?: FindOptions<MongoDocument>): Promise<D | undefined> {
		const res = await this.getCollection().findOne(filter, options);
		if (!res) {
			return undefined;
		}

		return this.transform(res);
	}

	/**
	 * Returns a boolean indicating whether or not a Document exists
	 * @param filter
	 */
	public async exists(filter: Filter<MongoDocument> | I): Promise<boolean> {
		return (await this.count(filter)) > 0;
	}

	/**
	 * Returns a boolean indicating whether or not a Document exists
	 * @param filter
	 */
	public async count(filter: Filter<MongoDocument> | I): Promise<number> {
		return await this.getCollection().countDocuments(filter);
	}

	/**
	 * Creates and returns a new Document using a given Input
	 */
	public async createOne(input: I): Promise<D> {
		const document = await this.build(input);
		await document.save();
		return document;
	}

	/**
	 * Creates and returns a new Document using a given Input
	 */
	public async createMany(input: I[]): Promise<D[]> {
		if (input.length === 0) {
			return [];
		}

		const documents = await Promise.all(input.map(i => this.build(i)));
		// @ts-ignore A conflict between _id and the IDs that it is looking for
		await this.getCollection().insertMany(documents.map(d => d.jsonify()));
		return documents;
	}

	/**
	 * Prints out a debug statement if debug is enabled
	 * @param statement
	 * @private
	 */
	private debugPrint(statement: string) {
		if (this.debug) {
			console.log(`FACTORY (${this.documentName}) -> ${statement}`);
		}
	}

	/**
	 * Returns the Collection used by this Document. Does so
	 * by creating a Dummy document and getting its Collection field
	 * @private
	 */
	private getCollection(): Collection {
		const dummyDoc = new this.documentInstantiator("fakeid");
		return dummyDoc.getCollection();
	}
}

export class DocumentReferenceList<D extends Document<DocumentInput>> {
	readonly _ids: DocumentID[];
	private readonly factory: DocumentFactory<DocumentInput, D>

	constructor(_ids: DocumentID[], factory: DocumentFactory<DocumentInput, D>) {
		this._ids = _ids;
		this.factory = factory;
	}

	public count() {
		return this._ids.length;
	}

	public async populate(): Promise<D[]> {
		return await this.factory.populateReferenceList(this);
	}
}

export class DocumentReference<D extends Document<DocumentInput>> extends Function {
	readonly _id: DocumentID;
	private readonly factory: DocumentFactory<DocumentInput, D>

	constructor(_id: DocumentID, factory: DocumentFactory<DocumentInput, D>) {
		super();
		this._id = _id;
		this.factory = factory;
	}

	public async populate(): Promise<D> {
		return await this.factory.populateReference(this);
	}

	override toString(): string {
		return this._id.toString();
	}
}

export abstract class Document<I extends DocumentInput> extends Object {
	readonly _id: DocumentID;

	protected constructor(_id?: DocumentID) {
		super();
		this._id = _id || idgen();
	}

	/**
	 * Instantiates the data in this Document. Is triggered by the Factory
	 * @param input
	 * @protected
	 */
	public abstract instantiate(input: I);

	/**
	 * Generates a Reference to this Document
	 */
	public abstract ref(): DocumentReference<Document<I>>;

	/**
	 * Attempts to save the Document into its Collection. Updates one if it
	 * exists already, or upserts otherwise.
	 */
	async save() {
		await this.getCollection().updateOne({
			_id: this._id
		}, {
			$set: {
				_data: this.toInput()
			}
		}, {
			upsert: true
		});
	}

	/**
	 * Return a ready-to-save JSON representation of the Document.
	 */
	public toInput(): I {
		// Call an internal method then re-inject the _id field if it hasn't been already
		let compressed = this.jsonify();
		compressed._id = this._id;
		return compressed
	}

	/**
	 * Returns a sanitized version of the Document fit for consumption by
	 * appropriate audiences. If 'sanitized' is not implemented, returns the
	 * Document's JSON representation
	 */
	public export(): Dict {
		return this.toInput();
	}

	/**
	 * Returns the Collection where this Document is stored
	 */
	public abstract getCollection(): Collection;

	/**
	 * Returns all internal data back to its 'input' compressed state for saving into Mongo
	 * @protected
	 */
	protected abstract jsonify(): I

}
