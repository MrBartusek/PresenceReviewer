import { InvalidRequestError } from './errors';
import psl, { ParsedDomain } from 'psl';
import axios from 'axios';
import dedent from 'dedent-js';
import * as whoiser from 'whoiser';
import Tranco from './tranco';
import { Logger } from 'probot';

interface UrlVerifyResult {
	popular: boolean
}

export async function verifyUrl(logger: Logger, rawUrl: string): Promise<UrlVerifyResult> {
	const url = parseUrl(rawUrl);

	// Check if presence exist
	const presences = (await axios.get('https://api.premid.app/v2/presences')).data as Array<any>;
	for(const presence of presences) {
		let urls = presence.metadata.url;
		if(!Array.isArray(urls)) urls = [ urls ];
		if(urls.includes(url) || urls.includes('www.' + url)) {
			throw new InvalidRequestError(dedent`
				This Presence already exist!\
				[${presence.name} Presence](https://premid.app/store/presences/${encodeURIComponent(presence.name)})\
				uses the url \`${url}\`.
			`);
		}
	}

	// Check if older than 2 months
	const whois = await whoiser.domain(url, {follow: 1}) as any;
	const firstWhois = whois[Object.keys(whois)[0]];
	const registeredString = firstWhois['Created Date'] || firstWhois['Creation Date'] as string;
	const registered = new Date(registeredString.substr(0, registeredString.indexOf('T')));
	const daysDiff = Math.floor(Math.abs(new Date().valueOf() - registered.valueOf()) / 86400000);
	if(daysDiff < 60) {
		throw new InvalidRequestError(`Websites must be at least 2 months old - \`${url}\` was registered ${daysDiff} days ago.`);
	}

	// Check popularity
	const tranco = new Tranco(logger);
	const rank = await tranco.getRank(url);
	const popular = rank <= 10000;

	return {popular: popular};
}

// Convert url to hostname: example.com or subdomain.example.com
function parseUrl(rawUrl: string): string {
	rawUrl = rawUrl.replace('http://', '').replace('https://', '');
	if(rawUrl.includes('/')) {
		rawUrl = rawUrl.substr(0, rawUrl.indexOf('/'));
	}
	let parsed = psl.parse(rawUrl);
	if(parsed.error) {
		throw new InvalidRequestError(`Provided domain \`${rawUrl}\` is not valid (${parsed.error.message})`);
	}
	parsed = parsed as ParsedDomain;
	if (parsed.subdomain == 'www' || parsed.subdomain == undefined)
		return parsed.domain as string;
	else
		return `${parsed.subdomain}.${parsed.domain}`;
}