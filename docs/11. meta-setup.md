# Setting up on the Meta side

Everything customers see on WhatsApp is owned by Meta, not by this app. Before the app can send or
receive a single message, somebody has to set up your business, your WhatsApp number and a Meta app on
Meta's own websites, then copy five values across.

This page walks through that once-only work. Do it in a browser on a computer — Meta's business tools
are awkward on a phone. Meta changes its menus and wording regularly, so treat the names below as a
guide rather than an exact map.

You will need:

- a Facebook account that is an **admin** of your company's business portfolio,
- a phone number for WhatsApp that is **not** already used on the WhatsApp app (or a number you are
  ready to move over),
- a way to receive the code sent to that number (SMS or phone call),
- your company's website, address and a business document such as a registration certificate,
- a payment method for message charges.

## Step 1: Business portfolio

1. Go to `business.facebook.com` and sign in.
2. If your company already has a portfolio, ask to be added as an admin instead of creating a second
   one — two portfolios for one company causes confusion later.
3. If you are starting fresh, choose **Create account**, enter the business name, your name and the
   business email, then confirm the email.
4. In **Business settings → Business info**, fill in the legal name, address, website and phone number.
   These are checked when Meta verifies the business.
5. In **Security centre**, turn on two-factor authentication for everyone who will administer the
   portfolio.

## Step 2: WhatsApp Business account and number

1. In **Business settings → Accounts → WhatsApp accounts**, choose **Add** and create a new WhatsApp
   Business account (or connect one you already own).
2. Open the new account and add the phone number. You can use a number that has never been on WhatsApp,
   or migrate one from the WhatsApp Business app; a number still active in the normal WhatsApp app
   cannot be used.
3. Confirm the number with the code Meta sends you.
4. Give the number a **display name** — this is what customers see. It must look like a real business
   name; names full of slogans or capitals are rejected.
5. Set a six-digit **two-step verification** PIN and store it safely. Meta asks for it when the number
   is re-registered.
6. In **Business settings**, complete **business verification** (upload the document Meta asks for). An
   unverified business can only message a small number of customers per day, and the limit grows as
   verification and message quality improve.
7. Add a **payment method** under billing. WhatsApp charges for business-initiated messages; replies
   inside the 24-hour customer service window are free.

## Step 3: Create the Meta app

1. Go to `developers.facebook.com` and choose **My Apps → Create app**.
2. Give it a name such as *Acme WhatsApp*, choose **Business** as the app type and link the business
   portfolio from Step 1.
3. On the app dashboard, find **WhatsApp** in the product list and choose **Set up**.
4. Meta adds a free **test number** with up to five recipient numbers. Use it to try things out before
   touching your real number.
5. Open **WhatsApp → API setup**. This page shows the test number, the **phone number ID** and the
   **WhatsApp Business account ID**, plus a temporary access token that expires in 24 hours. Do not use
   that temporary token in production; Step 4 replaces it.

Meta puts new apps in **Development** mode. In that mode messages only reach the test recipients you
listed. Switch the app to **Live** (top of the dashboard) when you are ready for real customers — Meta
asks for a privacy policy address and an app icon first.

## Step 4: A permanent access token

1. In **Business settings → Users → System users**, choose **Add**, name the user something like
   *waba-suite-bot* and give it the **Admin** role.
2. Choose **Add assets** and give this system user **full control** of both the app and the WhatsApp
   Business account.
3. Choose **Generate new token**, pick the app, and tick these permissions:
   - `whatsapp_business_messaging` — send messages and read their status,
   - `whatsapp_business_management` — read templates, numbers and account details.
4. Set the expiry to **Never** if Meta offers it, otherwise the longest period available. Copy the
   token immediately; Meta shows it only once.
5. If the token has an expiry date, note it in your calendar. When it lapses every send fails with an
   authentication error, and the app needs a fresh token.

## Step 5: Collect the five values

| What Meta calls it | Where to find it | Where it goes in the app |
| --- | --- | --- |
| Phone number ID | App dashboard → WhatsApp → API setup | WhatsApp Account, **Phone ID** |
| WhatsApp Business account ID | Same page, or Business settings → WhatsApp accounts | WhatsApp Account, **Business ID** |
| App ID | App dashboard → App settings → Basic | WhatsApp Account, **App ID** |
| Permanent access token | The token you generated in Step 4 | WhatsApp Account, **Token** |
| Verify token | A private phrase you invent yourself | WhatsApp Account **and** Meta's webhook page |

The verify token is not generated by anybody. Make up a long random phrase, keep it private, and paste
the same phrase in both places.

## Step 6: Point Meta at your site

Messages arrive as notifications ("webhooks") that Meta sends to your site. This is the step people
most often get wrong.

1. In the app dashboard open **WhatsApp → Configuration** and find the **Webhook** section.
2. Choose **Edit** and enter the callback address
   `https://your-site/api/method/waba_suite.utils.webhook.webhook`, replacing `your-site` with your real
   address. It must be the public `https` address — a local or `http` address will not verify.
3. Enter the same verify token you saved on the WhatsApp Account in the app.
4. Choose **Verify and save**. Meta sends a test request straight away. Verification only succeeds if
   an **active** WhatsApp Account in the app holds that same token, so set the account up first.
5. Open **Manage** next to the webhook and subscribe to the **messages** field. One subscription covers
   both incoming messages and delivery or read receipts.
6. Send a WhatsApp message from your own phone to the business number. It should appear in the chat
   portal within seconds.

If you add a second business number later, it belongs to the same app and webhook; only a new WhatsApp
Account is needed.

## Step 7: Templates

Templates are created on Meta's side and reviewed there.

1. Open **WhatsApp Manager → Account tools → Message templates** and choose **Create template**.
2. Pick the category — **Marketing** for offers and announcements, **Utility** for order, invoice and
   appointment updates, **Authentication** for one-time codes.
3. Choose the language, then write the header, body, footer and buttons. Put sample values against the
   placeholders such as `{{1}}`, or Meta rejects the template.
4. Submit. Most templates are reviewed within minutes, but allow up to 24 hours. A rejection is
   normally caused by a placeholder at the very start or end of the message, sales wording in a utility
   template, missing samples, or excessive capitals and emojis.
5. Back in the app, open the template list and choose **Sync from Meta** so the approved template can be
   used in chats, campaigns and notifications.

Flows are also built on Meta's side, under **WhatsApp Manager → Flows**. Build the screens there and
publish the flow; the app can then attach it to a template and download it for editing.

## Step 8: Test before going live

1. In Development mode, add your own phone as a test recipient and send yourself a template from the
   app's template list.
2. Reply from your phone and check the message appears in the chat portal, with a read receipt.
3. Try a photo and a document in both directions.
4. Switch the app to Live, then repeat with a colleague's number that is not a test recipient.
5. Send one small bulk campaign to a short recipient list before using a large one.

## When something does not work

| What you see | What it usually means |
| --- | --- |
| Webhook verification fails | The token in Meta and on the account differ, or the account is not **Active** |
| Everything stopped after a day | The temporary token from the API setup page was used; replace it with the permanent one |
| `(#131030)` or "recipient not in allowed list" | The app is still in Development mode and the number is not a test recipient |
| Template not found, or parameter mismatch | The template is not approved, was never synced, or the number of values does not match the placeholders |
| Messages send but replies never arrive | The webhook is missing, or the **messages** field is not subscribed |
| Permission or authentication errors | The token expired, or it lacks the messaging and management permissions |
| Display name rejected | The name does not look like a business name, or the business is not verified yet |
| Sending blocked or limited after a good start | Payment method missing, business not verified, or message quality dropped |

Use [Administration](administration.md) for the values that go into the app, and
[Questions and fixes](faq.md) for problems inside the chat portal itself.

---

**Previous:** [← Administration](administration.md) · **Index:** [User guide](README.md) · **Next:** [Questions and fixes →](faq.md)

