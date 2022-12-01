// Gets the permission level of a collaborator on the specified repository
// Returns `ADMIN`, `MAINTAIN`, `READ`, `TRIAGE` or `WRITE`.
module.exports = async (context, token, owner, repo, collaborator) => {
  const gitHubAPIRequest = require('./github-api-request')
  const answer = await gitHubAPIRequest(
    context,
    token,
    'POST',
    '/graphql', {
      query: `query CollaboratorPermission($owner: String!, $repo: String!, $collaborator: String) {
        repository(owner:$owner, name:$repo) {
          collaborators(query: $collaborator) {
            edges {
              permission
            }
          }
        }
      }`,
      variables: {
        owner,
        repo,
        collaborator
      }
    }
  )
  if (answer.error) throw answer.error
  return answer.data.repository.collaborators.edges.map(e => e.permission.toString())
}