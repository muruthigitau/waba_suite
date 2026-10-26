# Automatic notifications

Automatic notifications send a WhatsApp template without anybody pressing send. Typical uses:

- tell a customer their invoice is ready,
- remind them that a payment is due in three days,
- welcome a new lead the moment it is created,
- send a weekly summary to the sales team,
- confirm a booking as soon as it is approved.

Every notification uses an approved template. Nothing is written by hand, so the message always looks
the same and WhatsApp already allows it.

## Two kinds of notification

| Kind | Sends when | Example |
| --- | --- | --- |
| **Record event** | a record is created, saved, submitted, cancelled or updated | invoice submitted → send the invoice template |
| **Scheduled** | every hour, day, week or month — or a number of days before/after a date on the record | due date minus 3 days → payment reminder |

Record events react immediately. Scheduled notifications run in the background and pick up whatever
matches at that moment, so they are ideal for reminders.

## Setting one up

1. Open **WhatsApp Notification** in Desk and create a new one.
2. Give it a name you will recognise later.
3. Choose the kind: record event or scheduled.
4. Choose the record type and the event — for example *Sales Invoice* and *Submit*.
5. Choose the approved template to send.
6. Choose the WhatsApp number to send from, or leave it to use the default account.
7. Choose the phone field on the record that holds the customer's number.
8. Fill in the template values. They can come from the record (customer name, invoice number, amount)
   or be typed once here.
9. Optionally add a condition, so the message only goes out when the record deserves it — for example
   only when an amount is above a threshold.
10. Optionally attach a document, such as a PDF of the invoice, as the template header.
11. Save, then switch it on.

Send a test first: raise a record that matches and check that the message arrives and that it appears
in the WhatsApp message list in Desk. If it does not, see [Questions and fixes](faq.md).

## Scheduled notifications in detail

For a scheduled notification you also choose:

- **how often** it runs — hourly, daily, weekly, monthly;
- **which date on the record** it looks at, and **how many days before or after** that date to send.

For example: record type *Sales Invoice*, date *Due Date*, three days before, daily. Every day the
system finds invoices due in three days and sends the reminder template.

Be careful with wide date windows: a notification that runs daily will send again on the next run if
the record still matches. Keep the condition tight enough that each customer gets one message, not
five.

## Attaching a PDF

Many templates have a document header. When that is the case you can attach:

- a print of the record (choose the print format and letterhead),
- a file that is already attached to the record,
- a fixed file uploaded with the notification.

The customer receives the template with the document attached, exactly as it appears in the template
preview.

## After a notification has sent

- The message is recorded in the WhatsApp message list in Desk, and appears in the customer's chat in
  the portal when that contact already has a conversation.
- Delivery and read status come from WhatsApp, like any other message.
- Optionally, the record can be updated after sending — for example to tick *Reminder sent* — so you
  can see at a glance which records have been messaged.

## Good practice

- One notification per purpose. Two notifications for the same event means two messages to the
  customer.
- Test with your own number before switching it on for customers.
- Keep the condition simple and readable; a complicated rule is hard to trust.
- Remember templates: if the wording must change, update the template in Meta, not the notification.
- Check the WhatsApp message list in Desk from time to time for failures.

---

**Previous:** [← Chatbot and AI replies](chatbot-and-ai.md) · **Index:** [User guide](README.md) · **Next:** [Reports →](reports.md)
