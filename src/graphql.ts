import { Context } from 'probot';

interface LabelList {
	invalid?: boolean,
	popular?: boolean,
	regionRestricted?: boolean,
	paidService?: boolean,
	nsfw?: boolean
}

interface DiscussionInfo {
	body: string,
	currentCommentId?: string,
}

export async function getDiscussionInfo(context: any, number: number): Promise<DiscussionInfo> {
	const repo = context.payload.repository;
	const response = await context.octokit.graphql(`
		query($repoOwner: String!, $repoName: String!, $number: Int!) {
			repository(owner: $repoOwner, name: $repoName) {
				discussion(number: $number) {
					body,
					comments(first: 100) {
						edges {
							node {
								id,
								viewerDidAuthor
						  	}
						}
					}
				}
			}
		}
	`, {
		repoOwner: repo.owner.login,
		repoName: repo.name,
		number: number
	}) as any;

	const discussion = response.repository.discussion;
	const comment = discussion.comments.edges.find((x: any) => x.node.viewerDidAuthor);
	return {
		body: discussion.body,
		currentCommentId: comment ? comment.node.id : comment,
	}; 
}

export async function commentDiscussion(context: Context, nodeId: string, body: string, replyToId?: string): Promise<void> {
	await context.octokit.graphql(`
		mutation($id: ID!, $body: String!, $replyToId: ID) {
			addDiscussionComment(input: {discussionId: $id, body: $body, replyToId: $replyToId}) {
				comment {
					body
				}
			}
		}
	`, {
		id: nodeId,
		body: body,
		replyToId: replyToId
	}) as any;
}

export async function updateDiscussionComment(context: Context, nodeId: string, body: string): Promise<void> {
	await context.octokit.graphql(`
		mutation($id: ID!, $body: String!) {
			updateDiscussionComment(input: {commentId: $id, body: $body}) {
				comment {
					body
				}
			}
		}
	`, {
		id: nodeId,
		body: body
	}) as any;
}

export async function labelDiscussion(context: any, labelsToAdd: LabelList): Promise<void> {
	const repo = context.payload.repository;
	const labelsResponse = await context.octokit.graphql(`
		query($repoOwner: String!, $repoName: String!) {
			repository(owner: $repoOwner, name: $repoName) {
				labels(first: 100) {
					edges {
						node {
							name,
							id
						}
					}
				}
			}
		}`, {
		repoOwner: repo.owner.login,
		repoName: repo.name
	}
	) as any;
	const rawLabels = labelsResponse.repository.labels.edges.map((x: any) => x.node) as Array<{name: string, id: string}>;

	const labelNames = {
		invalid: 'Invalid',
		popular: 'Popular',
		regionRestricted: 'Region Restricted',
		paidService: 'Paid Service',
		nsfw: 'NSFW'
	};

	const labelsIds: Array<string> = [];
	for(const [labelName, shouldAdd] of Object.entries(labelsToAdd)) {
		if(!shouldAdd) continue;
		const name: string = (Object.entries(labelNames).find(x => x[0] == labelName)?.[1] as any);
		const label = rawLabels.find(x => x.name.includes(name));
		if(label == null) {
			throw Error(`Label containing "${labelName}" was not found in ${repo.name}${repo.owner.login}"`);
		}
		labelsIds.push(label.id);
	}

	await context.octokit.graphql(`
		mutation($discussionId: ID!, $labels: [ID!]!) {
			clearLabelsFromLabelable(input: {labelableId: $discussionId}) {
				clientMutationId
			}
			addLabelsToLabelable(input: { labelableId: $discussionId, labelIds: $labels}) {
				clientMutationId
			} 
		}`, {
		discussionId: context.payload.discussion.node_id,
		labels: labelsIds
	}
	) as any;
}

export async function addDiscussionReaction(context: Context, id: string, reaction = 'THUMBS_UP'): Promise<void> {
	await context.octokit.graphql(`
		mutation($id: ID!, $reaction: ReactionContent!) {
			addReaction(input: {subjectId: $id, content: $reaction}) {
				clientMutationId 
			}
		}
	`, {
		id: id,
		reaction: reaction
	}) as any;
}