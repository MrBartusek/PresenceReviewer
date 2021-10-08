export class InvalidRequestError extends Error {
	// This Error is expected to be thrown directly to user
	constructor(message?: string) {
		super(message);

		Object.setPrototypeOf(this, InvalidRequestError.prototype);
	}
}