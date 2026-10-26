# Templates and flows

## What a template is

A template is a message that WhatsApp has reviewed and approved in advance. You need one whenever you
write to somebody who has not messaged you in the last 24 hours, and for every bulk message
([Conversations](conversations.md#the-24-hour-rule)).

Because WhatsApp reviews templates, they follow a fixed structure:

- an optional **header** — plain text, an image, a video, a document or a location,
- a **body** with the main text,
- an optional **footer** for small print,
- optional **buttons** such as *Yes / No* or *Visit website*.

Templates are created and submitted for approval in Meta's WhatsApp Manager, then brought into this
system by your administrator. Approval usually takes minutes, sometimes longer; a rejected template has
to be edited and submitted again.

Templates are grouped by purpose: marketing messages, utility messages such as order updates, and
authentication codes. Marketing templates are the most strictly reviewed — keep them factual and avoid
excessive capitals and emojis.

## Sending a template

In a conversation, open the template picker (directly, or via the **Send Template Message** button when
the 24-hour window is closed). Choose a template and you will see a preview.

Some templates contain placeholders such as a customer name or an order number. These are filled in one
of two ways:

- **From a record** — when a template is sent from a customer, invoice or lead, the values can come from
  that record automatically.
- **By hand** — the picker asks you for the values before sending.

Always read the preview before pressing send. A template cannot be edited or recalled after it has gone
out.

> Use the right number. Templates are stored against the WhatsApp number they were synced for, so a
> template that exists on one account may be missing on another. Switch accounts to check.

## Sending a record from Desk

From any record in Desk — an invoice, a lead, a customer — choose **Send To Whatsapp** in the form menu.
Pick the account and template, review the preview and the values, optionally attach a PDF of the record,
and send. A note is added to the record so colleagues can see that a message went out.
See [WhatsApp in Desk](desk.md).

## WhatsApp Flows

A flow is a small form that opens **inside WhatsApp**: a few screens of questions with buttons, lists
and input fields. It is the tidy way to collect information — an appointment request, a survey, a
sign-up, a delivery address.

A typical flow has screens such as *Welcome → Your details → Choose a slot → Done*. Answers are
validated as the customer goes, so you receive clean data instead of a paragraph of free text.

Flows are built in Desk by an administrator. Each flow has:

- a name and a purpose category,
- the screens and the fields on each screen,
- a closing message,
- an optional action when the customer finishes — create a record such as a lead or ticket, send a
  confirmation, or run a custom step.

A flow is reached in one of these ways:

- from a **template button** that opens the flow,
- from a **chatbot step**, so a conversation can hand over to the form,
- from a **keyword rule**, when the customer asks for something like *appointment*.

Flows go through the same Meta review as templates: a flow must be published before customers can use
it. While it is a draft, nothing is sent to customers.

## Practical tips

- Keep the body of a template short; long messages get cut off on small screens.
- Reuse a small set of well-written templates instead of creating a new one for every campaign.
- Name templates by purpose, for example *order_dispatch_update*, so colleagues can find them.
- Test a new template on your own number before using it in a campaign.
- If a template is missing from the picker, it is either not approved yet or not synced — ask your
  administrator.

---

**Previous:** [← Bulk messaging](bulk-messaging.md) · **Index:** [User guide](README.md) · **Next:** [Chatbot and AI replies →](chatbot-and-ai.md)
