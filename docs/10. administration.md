# Administration

This page is for the person who connects WhatsApp to the system. Do it once, then keep users, labels and
templates tidy.

## What you need from Meta

Ask whoever manages your Meta business account for:

- a **WhatsApp Business account** with the phone number you want to use,
- a **permanent access token** for that account,
- the **phone number ID** of the WhatsApp number,
- the **business account ID** and **app ID**,
- permission to edit the app's WhatsApp settings, so you can register the webhook.

You also invent a **verify token** — any private word or phrase. You will paste the same value in two
places, so write it down.

If none of that exists yet, or you are unsure where to click on Meta's side, follow
[Setting up on the Meta side](meta-setup.md) first and come back with the five values.

## Connect the account

1. In Desk, create a new **WhatsApp Account**.
2. Give it a clear name — usually the number or brand, for example *Acme Support*.
3. Paste the access token, phone number ID, business account ID and app ID.
4. Leave the connection address and version as they are unless Meta has told you otherwise.
5. Enter your verify token.
6. Set the account to **Active**. Only active accounts appear in the chat portal.
7. Save. Then test by sending a WhatsApp message from your own phone to the business number; it should
   appear in the chat portal once the webhook is registered (next section).

Repeat for every business number. Each number is a separate account.

## Register the webhook in Meta

The app cannot receive messages until Meta knows where to send them.

1. In the Meta app, open the WhatsApp → Configuration page.
2. Set the callback URL to your site address followed by
   `/api/method/waba_suite.utils.webhook.webhook`.
3. Enter the same verify token you used on the account.
4. Verify and save. Meta sends a test request; if the token matches an active account, verification
   succeeds.
5. Subscribe to message events, including message status updates, so delivery and read marks arrive.
6. Send a WhatsApp message from your own phone to the business number and confirm it appears in the
   chat portal.

If verification fails, the token on the account and the token in Meta are not the same, or the account
is not active.

## Users and access

- Add team members to an account's user list. They will see that number in the chat portal.
- Each person can have one default account, which is the one they land on after signing in.
- Remove a user from the account when they leave the team; they immediately lose access to its chats.
- Sending bulk campaigns and running reports need the manager role. Give it only to people who need it.

## Defaults

- Choose one **default incoming** account: this is where messages go when Meta does not make the number
  obvious.
- Choose one **default outgoing** account: this is used when a template or notification does not name an
  account.

Only one of each can exist. If you see a warning when saving, another account already holds that
default.

## Nice-to-have settings per account

- **Read receipts** — mark customer messages as read automatically when a chat is opened.
- **Business hours** — the hours your team is available, plus an away message sent outside them.
- **Automatic lead creation** — create a lead the first time a new number writes in, so nobody forgets to
  follow up.
- **Chatbot** — switch automatic replies on for this number.

## Labels

Create **WhatsApp Chat Label** records: a short name, a colour and an optional description. They appear
as filter buttons in the chat portal and as coloured tags on chats. Keep the list small — ten clear
labels beat forty overlapping ones. Disable a label instead of deleting it if it is already in use.

## Templates

Templates are written and approved in Meta's WhatsApp Manager. To bring them in, open the
**WhatsApp Templates** list in Desk and choose **Sync from Meta**. Newly approved templates appear;
existing ones are refreshed.

A few rules worth knowing:

- a template must be approved before it can be sent, and approval can take a while;
- templates are stored per account, so a template approved on one number may need syncing on another;
- editing a template in Meta means syncing again before the change can be sent;
- never send an untested template to a customer list — send it to your own number first.

## Housekeeping

- Check the WhatsApp message list for failures once a week.
- Review campaigns that failed badly and correct the recipient lists.
- Review keyword rules now and then: remove rules for old promotions.
- Keep an eye on accounts that are no longer used; disable them rather than deleting history.
- When Meta retires an old connection version, the account stops working until it is updated. Update the
  version when Meta announces a retirement.

## Roles at a glance

| Role | Typical access |
| --- | --- |
| WhatsApp User | Chat portal for assigned accounts; labels, pins, stars and archive; prepare campaigns |
| WhatsApp Manager | Everything an agent can do, plus send campaigns and run reports |
| System Manager | Everything, including accounts, users, settings, templates and notifications |

---

**Previous:** [← WhatsApp in Desk](desk.md) · **Index:** [User guide](README.md) · **Next:** [Setting up on the Meta side →](meta-setup.md)
