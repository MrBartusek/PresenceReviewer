import fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import { Logger } from 'probot';
import AdmZip from 'adm-zip';

export default class Tranco {
	constructor(
		private logger: Logger
	) { }

	async update(): Promise<void> {
		await axios.get('https://tranco-list.eu/top-1m.csv.zip', { responseType: 'arraybuffer' })
			.then((response: AxiosResponse<Buffer>) => {
				const zip = new AdmZip(response.data);
				const entries = zip.getEntries();
				const csv = entries[0].getData().toString('utf-8');
				const result = [];
				for(const line of csv.split('\r\n')) {
					const values = line.split(',');
					result.push({
						'rank': values[0],
						'name': values[1]
					});
				}
				const json = JSON.stringify({timestamp: new Date().getTime() / 1000, data: result});
				fs.writeFileSync('tranco.json', json);
			});
		this.logger.info('Updated tranco list');
		
	}

	async getRank(domain: string) : Promise<number> {
		const domainSplit = domain.split('.');
		const host = `${domainSplit[domainSplit.length - 2]}.${domainSplit[domainSplit.length - 1]}`;
		const list = await this._getList();
		const result = list.find(x => x.name == host);
		return result ? result.rank : 10000000;
	}

	async _getList(): Promise<Array<{rank: number, name: string}>> {
		if(fs.existsSync('tranco.json')) {
			const result = JSON.parse(fs.readFileSync('tranco.json').toString());
			const SECONDS_IN_DAY = 86400;
			if(result.timestamp + SECONDS_IN_DAY * 7 < new Date().getTime() / 1000) {
				this.logger.info('Updating tranco list because it\'s older than 7 days');
			}
			else {
				return result.data;
			}
		}
		await this.update();
		return this._getList();
	}
}