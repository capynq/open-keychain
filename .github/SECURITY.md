# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Use GitHub's private security advisory flow for this repository or contact the maintainer through the email listed on the maintainer's GitHub profile.

The default project is a client-side application and does not require a backend, but the repository also contains an optional hosted API for accounts, quotas, and saved projects. Reports about dependency vulnerabilities, unsafe font handling, archive generation, authentication, quota enforcement, and exported geometry are welcome.

Please include whether the issue affects the local-only build, the hosted API, or both. Do not include credentials, private user data, or an unredacted production configuration in a report.

## Supported versions

Only the latest `main` branch is supported. Please include the commit, browser, operating system, and a minimal reproduction when reporting an issue.
