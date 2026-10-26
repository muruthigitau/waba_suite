# Chatbot and AI replies

The chatbot answers customers automatically when nobody is at the keyboard — outside working hours, or
while your team is busy. It can send a simple reply, a template, a file, or start a flow that collects
details. Optionally it can also let an AI assistant answer in natural language.

An administrator switches the chatbot on and decides which number it serves.

## How an incoming message is handled

1. Is the chatbot switched on for this account? If not, the message simply waits for a person.
2. Has this customer been handed over to a human? Then the chatbot stays quiet.
3. Is a **flow** waiting for an answer from this customer? The answer moves the flow forward.
4. Do any **keyword rules** match? The highest-priority match replies.
5. Is **AI** switched on and no keyword matched? The AI writes the reply.
6. Otherwise the **default response** is sent — a friendly "we have received your message" style reply.

## Keyword rules

A keyword rule says: *when a customer writes something like this, answer like that*.

For each rule you choose:

- the words to look for, for example *price*, *delivery*, *hours*;
- how the words must match — the whole message, anywhere in the message, or the beginning of the
  message;
- whether upper and lower case matters;
- one or more WhatsApp numbers it applies to, or all of them;
- a priority, so the most specific rule wins when several match;
- an optional period during which the rule is active;
- the reply: plain text, a template, a photo/video/document, or starting a flow.

Rules can be switched off without deleting them, which is handy for seasonal messages.

Example rules a shop might use:

| Customer writes | Reply |
| --- | --- |
| *hours* | Opening hours and a link to directions |
| *price* | The price list template |
| *order* | A flow that asks for the order number |
| *human* | Hands the chat to a person |

## Chatbot flows

A flow is a short guided conversation: ask a question, wait for the answer, ask the next one, confirm,
finish. It is the same flow described in [Templates and flows](templates-and-flows.md), driven by the
chatbot.

- Each step waits for the customer's answer and checks that it makes sense (a number, a choice from a
  list, an email address).
- Answers are stored with the conversation, so a colleague can read them later.
- A flow can be cancelled by the customer with words such as *cancel* or *stop*.
- If the customer stops answering, the flow closes after a timeout and can send a closing message.

When a flow finishes it can create a record — a lead, a ticket, a request — or simply send a
confirmation. What happens at the end is set up by whoever built the flow.

## Handing over to a person

Sometimes automation is not enough. Use the transfer option to hand a chat to a colleague:

- the chatbot stops answering for that number;
- the conversation stays in the chat portal for a person to pick up;
- when you are done, resume the chatbot so it answers again.

Being transferred does not send a message by itself — write to the customer as usual. And remember the
24-hour rule ([Conversations](conversations.md#the-24-hour-rule)): if the window closed while the chat
was with a person, reopen it with a template.

## AI replies

An administrator can switch on AI answers and choose the AI provider, the model and a system prompt —
the instruction that sets the assistant's tone and limits, for example *"You are the support assistant
of Acme. Be brief. Never quote prices."*

Useful options:

- **Include conversation history** so the assistant remembers the last few messages instead of
  answering each one in isolation.
- **Default response** as the fallback when the AI cannot answer.

AI answers are sent as ordinary text messages, so they follow the 24-hour rule like everything else.
Keep answers short: an AI that writes essays is hard to read on a phone.

## Common settings

- **Excluded numbers** — colleagues' numbers and test numbers that should never receive automatic
  replies.
- **Business hours** — when the chatbot is allowed to answer, and what to say outside those hours.

## Tips

- Write keyword rules the way customers actually type: short, lower case, with typos in mind.
- Add a *human* keyword rule so customers can always reach a person.
- Test with your own number before switching the chatbot on for customers.
- Review chats that the chatbot handled and improve the rules that performed badly.
- Check the result: a rule that never matches is wasted, and one that matches too often is annoying.

---

**Previous:** [← Templates and flows](templates-and-flows.md) · **Index:** [User guide](README.md) · **Next:** [Automatic notifications →](notifications.md)
