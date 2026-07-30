"""WhatsApp Template Variable DocType.

Represents a single variable within a WhatsApp message template,
supporting auto-indexing by variable type (Header/Body/Footer).

Key dependencies:
    - frappe: ERPNext framework
"""

import frappe
from frappe.model.document import Document


class WhatsAppTemplateVariable(Document):
    """DocType for template variable definitions.

    Each variable belongs to a template and has a type (Header/Body/Footer),
    source type (DocField/Static/Computed), and auto-calculated index.
    """

    def validate(self):
        """Validate the document and auto-set the index."""
        self.auto_set_index()

    def auto_set_index(self):
        """Auto-calculate index based on type (Header/Body/Footer).

        If no index is set, computes the next available index by finding
        the maximum existing index for the same type within the parent.
        """
        if not self.type:
            self.type = "Body"

        if not self.index and self.parent:
            same_type_rows = frappe.get_all(
                "WhatsApp Template Variable",
                filters={
                    "parent": self.parent,
                    "parenttype": self.parenttype,
                    "type": self.type,
                },
                fields=["idx", "index"],
                order_by="idx asc",
            )
            max_idx = 0
            for row in same_type_rows:
                r_idx = row.get("index") or row.get("idx") or 0
                if r_idx > max_idx:
                    max_idx = r_idx
            self.index = max_idx + 1