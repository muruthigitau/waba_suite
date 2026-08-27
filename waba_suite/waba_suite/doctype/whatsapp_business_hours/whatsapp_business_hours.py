# Copyright (c) 2026, Shridhar Patil and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class WhatsAppBusinessHours(Document):
	"""Child table storing the working days and time ranges for a WhatsApp Account.

	Each row defines one working window (day of week + start/end time) used to
	decide whether the away auto-reply should be triggered.
	"""
	pass
