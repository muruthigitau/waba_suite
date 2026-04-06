import frappe
import re
from datetime import datetime


class KeywordMatcher:
    def __init__(self, whatsapp_account=None):
        try:
            self.account = whatsapp_account
            self.rules = self.load_rules()
        except Exception:
            frappe.log_error(
                title="KeywordMatcher Init Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Account",
                reference_name=whatsapp_account,
            )

    def load_rules(self):
        try:
            rules = frappe.get_all(
                "WhatsApp Keyword Reply",
                filters={"enabled": 1},
                fields=["*"],
                order_by="priority desc",
            )

            now = datetime.now()
            valid_rules = []

            for rule in rules:
                if rule.whatsapp_account and rule.whatsapp_account != self.account:
                    continue

                if rule.active_from and now < rule.active_from:
                    continue
                if rule.active_until and now > rule.active_until:
                    continue

                valid_rules.append(rule)

            return valid_rules

        except Exception:
            frappe.log_error(
                title="KeywordMatcher Load Rules Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Keyword Reply",
            )
            return []

    def match(self, message_text):
        if not message_text:
            return None

        try:
            for rule in self.rules:
                if self.rule_matches(rule, message_text):
                    if rule.conditions:
                        if not self.evaluate_conditions(
                            rule.conditions, message_text, rule.name
                        ):
                            continue
                    return frappe.get_doc("WhatsApp Keyword Reply", rule.name)
        except Exception:
            frappe.log_error(
                title="KeywordMatcher Match Logic Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Keyword Reply",
            )

        return None

    def rule_matches(self, rule, message_text):
        try:
            if not rule.keywords:
                return False

            keywords = [k.strip() for k in rule.keywords.split(",") if k.strip()]
            text = message_text if rule.case_sensitive else message_text.lower()

            for keyword in keywords:
                kw = keyword if rule.case_sensitive else keyword.lower()

                if rule.match_type == "Exact":
                    if text == kw:
                        return True

                elif rule.match_type == "Contains":
                    if kw in text:
                        return True

                elif rule.match_type == "Starts With":
                    if text.startswith(kw):
                        return True

                elif rule.match_type == "Regex":
                    try:
                        flags = 0 if rule.case_sensitive else re.IGNORECASE
                        if re.search(kw, message_text, flags):
                            return True
                    except re.error as e:
                        frappe.log_error(
                            title=f"Invalid Regex in Keyword Rule: {rule.name}",
                            message=f"Regex Error: {str(e)}\n{frappe.get_traceback()}",
                            reference_doctype="WhatsApp Keyword Reply",
                            reference_name=rule.name,
                        )

            return False
        except Exception:
            frappe.log_error(
                title="Keyword Rule Matching Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Keyword Reply",
                reference_name=rule.name,
            )
            return False

    def evaluate_conditions(self, conditions, message_text, rule_name):
        try:
            eval_globals = {
                "message": message_text,
                "len": len,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
            }

            return frappe.safe_eval(
                conditions, eval_globals=eval_globals, eval_locals={}
            )
        except Exception:
            frappe.log_error(
                title="Keyword Condition Evaluation Error",
                message=frappe.get_traceback(),
                reference_doctype="WhatsApp Keyword Reply",
                reference_name=rule_name,
            )
            return False
