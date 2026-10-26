# WABA Suite

An all-in-one WhatsApp Business API (WABA) integration for the Frappe Framework: multi-account
messaging, a React/Vite chat client, Meta template and WhatsApp Flow management, bulk
campaigns, rule-based chatbot automation, AI replies, notifications, and analytics.

- **Framework:** Frappe >= 16 (< 17)
- **Python:** >= 3.10
- **Frontend:** React 19 + Vite chat client served at `/whatsapp`
- **License:** AGPL-3.0

## Documentation

The user guide lives in [`docs/`](docs/README.md) — help for everyone who uses the
chat portal, bulk messaging, chatbot and reports.

| Document                                                   | Contents                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [docs/README.md](docs/README.md)                           | Guide index and who does what                                   |
| [docs/getting-started.md](docs/getting-started.md)         | Signing in, choosing an account, first conversation             |
| [docs/chat-portal.md](docs/chat-portal.md)                 | Chat list, search, labels, pins, stars and archiving            |
| [docs/conversations.md](docs/conversations.md)             | Sending messages and files, replies, the 24-hour rule           |
| [docs/bulk-messaging.md](docs/bulk-messaging.md)           | Recipient lists and campaigns                                   |
| [docs/templates-and-flows.md](docs/templates-and-flows.md) | Approved templates and in-chat forms                            |
| [docs/chatbot-and-ai.md](docs/chatbot-and-ai.md)           | Automatic replies, keyword rules, flows and hand-over           |
| [docs/notifications.md](docs/notifications.md)             | Sending a template automatically on record events and schedules |
| [docs/reports.md](docs/reports.md)                         | Campaign and conversation reports                               |
| [docs/desk.md](docs/desk.md)                               | WhatsApp workspace, message list, **Send To Whatsapp**          |
| [docs/administration.md](docs/administration.md)           | Connecting accounts, users, labels, templates and settings      |
| [docs/meta-setup.md](docs/meta-setup.md)                   | Business portfolio, WhatsApp number, app, token and webhook     |

| [docs/faq.md](docs/faq.md) | Common questions and fixes |

## Quick start

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app waba_suite
bench --site your-site migrate
```

Then create a **WhatsApp Account**, add users to its **Users** table, set the account **Status**
to _Active_, and register
`https://your-site/api/method/waba_suite.utils.webhook.webhook` as the Meta webhook callback.
See [docs/administration.md](docs/administration.md).

## Contributing

This app uses `pre-commit` for formatting and linting:

```bash
cd apps/waba_suite
pre-commit install
pre-commit run --files path/to/changed/file.py
```

Pre-commit is configured with ruff, eslint, prettier and pyupgrade.

## License

agpl-3.0
