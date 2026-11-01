# Security policy

CareerPilot is a self-hosted, single-user job-search dashboard. You run it yourself; nobody runs it for you, and it sends nothing about you anywhere except to the AI provider and job sources you configure.

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**.
- Include what you found, how to reproduce it, and which version or commit.

You can expect an acknowledgement within a few days. This is a small open-source project, so there is no bounty and no guaranteed timeline, but reports are taken seriously and credited if you want.

## What is in scope

The application in `apps/web`, the `pilot` command line in `apps/cli`, the Docker files, and the sign-in, API-token, MCP connector and agent-access code in particular. Things that matter most to us:

- anything that lets someone without your password read or change your data;
- anything that lets an assistant, a job posting, an email or a file you import make CareerPilot do more than you asked (for example mark an application as sent, send something, or read other data);
- anything that sends your data somewhere you did not choose.

`upstream/` holds reference copies of two other projects; it is not part of the product and is not run.

## What the project already does

The threat model, the audits and the worklist are in [`docs/security/`](docs/security/): [`SECURITY_PLAN.md`](docs/security/SECURITY_PLAN.md) lists what is fixed and what is planned. In short: text from postings and emails is treated as data, never as instructions; assistants can only record that an application was rejected or declined, never that it was sent or that an interview happened; API tokens are scoped, hashed and rate limited; sign-in is throttled; and sessions can be ended everywhere from Settings.

## If you host it for others or put it on the internet

CareerPilot is built for one person. If you expose it, put it behind HTTPS (set the public address so cookies are secure), use a long random password and secret, keep the database off the network, and read [`docs/security/SECURITY_PLAN.md`](docs/security/SECURITY_PLAN.md). The development compose file (`apps/web/compose.yml`) is for development only.

## Source code

CareerPilot is licensed under the GNU Affero General Public License v3.0 only. If you run a modified version for other people over a network, the licence requires you to offer them your source.
