import dedent from 'dedent-js';
import { Probot } from 'probot';
import { praseRequest } from './praseRequest';
import { verifyUrl } from './verifyUrl';
import { InvalidRequestError } from './errors';
import * as graphql from './graphql';

export = (app: Probot) => {
	app.on(['discussion.created', 'discussion_comment.created'], async (context) => {
		if(context.isBot) return;
		const discussion = context.payload.discussion;
		app.log.info(`Processing ${context.name} on ${context.payload.repository.full_name}#${discussion.number} by ${context.payload.sender.login}`);

		// Check category
		if(discussion.category.name !== 'Presence Requests') {
			app.log.warn(`Skipping - invalid category: ${discussion.category.name}`);
			return;
		}

		// Check if can re-check
		if(context.name == 'discussion_comment') {
			const isAuthor = context.payload.comment.user.node_id == context.payload.discussion.user.node_id;
			const isMember = ['COLLABORATOR', 'MEMBER', 'OWNER'].includes(context.payload.comment.author_association);
			const isCommand = context.payload.comment.body.includes('/recheck');
			if(!isCommand) {
				app.log.warn('Skipping - comment is not a recheck command');
				return;
			}
			else if(!isAuthor && !isMember) {
				app.log.warn('Skipping - this user is not allowed to use recheck command here');
				return;	
			}
			else {
				await graphql.addDiscussionReaction(context, context.payload.comment.node_id);
			}
		}

		// Validate the request
		let request, verifyUrlResult;
		const discussionInfo = await graphql.getDiscussionInfo(context, discussion.number);
		try {
			request = praseRequest(discussion.body);
			verifyUrlResult = await verifyUrl(app.log, request.serviceUrl);
			app.log.info(`Request flags: ${JSON.stringify(request)}`);
		} catch (error) {
			if(error instanceof InvalidRequestError) {
				await graphql.labelDiscussion(context, { invalid: true });
				return commentOrUpdateResult(context, error.message, discussionInfo.currentCommentId);
			}
			else {
				throw error;
			}
		}

		await graphql.labelDiscussion(context, {
			popular: verifyUrlResult.popular,
			regionRestricted: request.regionRestricted,
			paidService: request.paidService,
			nsfw: request.nsfw
		});
		await commentOrUpdateResult(context, undefined, discussionInfo.currentCommentId);
	});

	async function commentOrUpdateResult(context: any, error?: string, commentId?: string) {
		const discussion = context.payload.discussion;
		let response = `Hey @${discussion.user.login}, thanks for creating the Presence Request! `;

		if(error) {
			app.log.warn(`Invalid request - ${error}`);
			response += dedent`I have found one issue with your proposal:
			
			❌ ${error}
			
			I have marked this request as invalid and thus, this presence won't be worked on. If you want to update\
			the request please edit this discussion and use \`/recheck\` command!`;
		}
		else {
			app.log.info('This request is valid');
			response = '✔️ ' + response;
			response += dedent` Please note that coding presences is completely voluntary and may take time for your\
			service to be added regardless of priority!`;
		}

		response += '\n\n*Beep boop. I am a bot, if you find any issues please report them [here](https://github.com/MrBartusek/PresenceReviewer).*';

		if(commentId) {
			return graphql.updateDiscussionComment(context, commentId, response);
		}
		else {
			return graphql.commentDiscussion(context, discussion.node_id, response);
		}
	}
};