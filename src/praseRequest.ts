import { InvalidRequestError } from './errors';

interface PresenceRequest {
    regionRestricted: boolean,
    paidService: boolean,
    nsfw: boolean,
    serviceUrl: string,
    imageUrl: string | null
}

export function praseRequest(text: string): PresenceRequest {
	// Remove HTML comments
	const commentRegex = /<![-]+([\s\S]*?)[-]+>/gm;
	text = text.replace(commentRegex, '');

	// Verify checkboxes
	const checkboxesRegex = /- \[[xX ]\]/gm;
	const checkboxesRaw = text.match(checkboxesRegex);
	if(checkboxesRaw == null || checkboxesRaw.length != 3) {
		throw new InvalidRequestError('This discussion doesn\'t use the [Service Request Template](https://github.com/PreMiD/Presences/discussions/4658)');
	}
	const checkboxes = checkboxesRaw.map(x => x.includes('x'));

	// Verify URLs
	let serviceUrl: string;
	let imageUrl: string | null = null;
	// eslint-disable-next-line no-useless-escape
	const urlRegex =  /(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?/g;
	const urlSearch = text.match(urlRegex);
	if (urlSearch != null) {
		serviceUrl = urlSearch[0];
		if (urlSearch.length > 1) {
			imageUrl = urlSearch[1];
		}
	}
	else {
		throw new InvalidRequestError('No valid URL for the service was found');
	}

	return {
		regionRestricted: checkboxes[0],
		paidService: checkboxes[1],
		nsfw: checkboxes[2],
		serviceUrl: serviceUrl,
		imageUrl: imageUrl
	};
}