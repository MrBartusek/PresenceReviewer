import fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import { Logger } from 'probot';
import AdmZip from 'adm-zip';

export class TrancoError extends Error {
	constructor(message?: string) {
		super(message);

		Object.setPrototypeOf(this, TrancoError.prototype);
	}
}

interface TrancoList {
	timestamp: number,
	list: { [key: string]: number }
}

export default class Tranco {
	constructor(
		private logger: Logger
	) { }

	async update(): Promise<TrancoList> {
		return axios.get('https://tranco-list.eu/top-1m.csv.zip', { responseType: 'arraybuffer' })
			.then((response: AxiosResponse<Buffer>) => {
				const zip = new AdmZip(response.data);
				const entries = zip.getEntries();
				const csv = entries[0].getData().toString('utf-8');
				const list: {[key: string]: number} = {};
				for(const line of csv.split('\r\n')) {
					const values = line.split(',');
					list[values[1]] = Number(values[0]);
				}
				const result = {
					timestamp: new Date().getTime() / 1000,
					list: list
				};
				const json = JSON.stringify(result);
				fs.writeFileSync('tranco.json', json);
				this.logger.info('Updated tranco list');
				return result;
			});
	}

	async getRank(domain: string) : Promise<number> {
		const domainSplit = domain.split('.');
		const host = `${domainSplit[domainSplit.length - 2]}.${domainSplit[domainSplit.length - 1]}`;
		const result = (await this._getList()).list[host];
		return result ? result : 10000000;
	}

	async _getList(): Promise<TrancoList> {
		if(fs.existsSync('tranco.json')) {
			const result = JSON.parse(fs.readFileSync('tranco.json').toString());
			const SECONDS_IN_DAY = 86400;
			if(result.timestamp + SECONDS_IN_DAY * 7 < new Date().getTime() / 1000) {
				this.logger.info('Updating tranco list because it\'s older than 7 days');
				return await this.update()
					.catch((error: Error) => {
						this.logger.warn('Failed to update old tranco list: ' + error);
						return result;
					});
			}
			else {
				return result.data;
			}
		}
		else {
			return await this.update().catch((error: Error) => {
				throw new TrancoError('Failed to initially download tranco list: ' + error);
			});
		}
	}
}