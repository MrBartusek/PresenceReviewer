import dedent from "dedent-js"
import { Probot } from "probot";
import { praseRequest } from "./praseRequest";
import { InvalidSchemaError } from "./errors";
import * as graphql from "./graphql"

export = (app: Probot) => {
	app.on("discussion.created", async (context) => {
		const discussion = context.payload.discussion;

		// Check category
		if(discussion.category.name !== "Presence Requests") {
			app.log(`Skipping ${discussion.title} - invalid category: ${discussion.category.name}`);
			return;
		}

		// Validate the schema
		let request; 
		const body = await graphql.getDiscussionBody(context, discussion.number)
		try {
			request = praseRequest(body)
		} catch (error) {
			if(error instanceof InvalidSchemaError) {
				await graphql.labelDiscussion(context, { invalid: true })
				return commentRequest(context, error.message)
			}
			else {
				throw error;
			}
		}

		await graphql.labelDiscussion(context, {
			popular: false,
			regionRestricted: request.regionRestricted,
			paidService: request.paidService,
    		nsfw: request.nsfw
		})
		await commentRequest(context)
	});

	async function commentRequest(context: any, error?: string) {
		// Context is any here since Contex<"discussion"> throws:
		// Expression produces a union type that is too complex to represent. ts(2590)
		// and I have no idea how to fix it

		const discussion = context.payload.discussion;
		let response = `Hey @${discussion.user.login}, thanks for creating the Presence Request! `

		if(error) {
			response += dedent`I have found one issue with your proposal:
			
			❌ ${error}
			
			I have marked this request as invalid and thus, this presence won't be worked on. If you want to update\
			the request please edit this discussion and use \`/recheck\` command!`
		}
		else {
			response += dedent` Please note that coding presences is completely voluntary and may take time for your\
			service to be added regardless of priority!`
		}

		response += "\n\n*Beep boop. I am a bot, if you find any issues please report them [here](https://github.com/MrBartusek/PresenceReviewer).*"

		return graphql.commentDiscussion(context, discussion.node_id, response)
	}
};