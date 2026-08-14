import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Contact, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import React, { useMemo, useState } from "react";

interface ExistingContact {
  name: string;
  contact_name: string;
  mobile_no: string;
  has_chat: boolean;
  within_24h_window: boolean;
  can_send_direct: boolean;
}

// A Frappe Contact (from the standard Contact doctype phone_nos).
interface FrappeContact {
  name: string;
  contact_name: string;
  company_name?: string;
  phones: Array<{ phone: string; is_primary_phone: number }>;
  is_whatsapp_contact?: boolean;
  whatsapp_contact?: string;
}

type ModalTab = "whatsapp" | "frappe" | "new";

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappAccount: string;
  onSuccess?: (contact?: {
    id?: string;
    name?: string;
    contact_name?: string;
    mobileNo?: string;
    whatsappAccount?: string;
    hasChat?: boolean;
    within24hWindow?: boolean;
    canSendDirect?: boolean;
  }) => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  whatsappAccount,
  onSuccess,
}) => {
  const [tab, setTab] = useState<ModalTab>("whatsapp");
  const [contactName, setContactName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [frappeSearch, setFrappeSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const { call: createContactCall } = useFrappePostCall(
    "waba_suite.api.contacts.create",
  );
  const { call: convertContactCall } = useFrappePostCall(
    "waba_suite.api.contacts.convert_frappe_contact",
  );

  // Tab 1: existing WhatsApp contacts
  const { data: searchData, isLoading: searching } = useFrappeGetCall<{
    message: ExistingContact[];
  }>(
    "waba_suite.api.contacts.search",
    { query: searchQuery, whatsapp_account: whatsappAccount },
    isOpen && tab === "whatsapp" ? undefined : { enabled: false },
  );

  // Tab 2: Frappe Contacts
  const { data: frappeData, isLoading: frappeLoading } = useFrappeGetCall<{
    message: FrappeContact[];
  }>(
    "waba_suite.api.contacts.search_frappe_contacts",
    { query: frappeSearch },
    isOpen && tab === "frappe" ? undefined : { enabled: false },
  );

  const existingContacts = useMemo(() => searchData?.message || [], [searchData]);
  const frappeContacts = useMemo(() => frappeData?.message || [], [frappeData]);

  const emit = (contact: {
    id: string;
    contact_name?: string;
    mobile_no?: string;
    has_chat?: boolean;
    within_24h_window?: boolean;
    can_send_direct?: boolean;
  }) => {
    onSuccess?.({
      id: contact.id,
      name: contact.contact_name || contact.mobile_no,
      contact_name: contact.contact_name || contact.mobile_no,
      mobileNo: contact.mobile_no,
      whatsappAccount,
      hasChat: contact.has_chat,
      within24hWindow: contact.within_24h_window,
      canSendDirect: contact.can_send_direct,
    });
    onClose();
  };

  const handleCreate = async () => {
    if (!contactName.trim() || !mobileNo.trim()) return;

    setCreating(true);
    try {
      const res = await createContactCall({
        contact_name: contactName.trim(),
        mobile_no: mobileNo.trim(),
        whatsapp_account: whatsappAccount,
      }) as { message?: ExistingContact };
      emit({
        id: res?.message?.name || "",
        contact_name: res?.message?.contact_name || contactName.trim(),
        mobile_no: res?.message?.mobile_no || mobileNo.trim(),
        has_chat: res?.message?.has_chat,
        within_24h_window: res?.message?.within_24h_window,
        can_send_direct: res?.message?.can_send_direct,
      });
      setContactName("");
      setMobileNo("");
    } catch (error) {
      console.error("Failed to create contact:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleConvert = async (c: FrappeContact) => {
    setConverting(c.name);
    try {
      const res = await convertContactCall({
        contact_name: c.name,
        whatsapp_account: whatsappAccount,
      }) as { message?: ExistingContact };
      emit({
        id: res?.message?.name || "",
        contact_name: res?.message?.contact_name || c.contact_name,
        mobile_no: res?.message?.mobile_no || c.phones[0]?.phone,
        has_chat: res?.message?.has_chat,
        within_24h_window: res?.message?.within_24h_window,
        can_send_direct: res?.message?.can_send_direct,
      });
    } catch (error) {
      console.error("Failed to convert contact:", error);
    } finally {
      setConverting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[#202c33] rounded-lg shadow-xl w-[480px] max-w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942] shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-white">New Message</h3>
            <p className="text-xs text-[#8696a0] mt-0.5">
              Pick an existing WhatsApp/Frappe contact, or add a new one. A chat
              is only created once you send a message.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3942] rounded">
            <X className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a3942] shrink-0">
          <TabButton
            active={tab === "whatsapp"}
            label="WhatsApp"
            icon={<Users className="w-4 h-4" />}
            onClick={() => setTab("whatsapp")}
          />
          <TabButton
            active={tab === "frappe"}
            label="Frappe Contact"
            icon={<Contact className="w-4 h-4" />}
            onClick={() => setTab("frappe")}
          />
          <TabButton
            active={tab === "new"}
            label="New Contact"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setTab("new")}
          />
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* Tab 1: WhatsApp Contacts */}
          {tab === "whatsapp" && (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search WhatsApp contacts by name or number..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              <div className="space-y-1">
                {searching ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
                  </div>
                ) : existingContacts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[#8696a0] text-sm">
                      {searchQuery
                        ? "No WhatsApp contacts found."
                        : "No existing WhatsApp contacts yet."}
                    </p>
                    <button
                      onClick={() => setTab("new")}
                      className="text-xs text-[#25D366] mt-2 hover:underline"
                    >
                      Add a new contact instead
                    </button>
                  </div>
                ) : (
                  existingContacts.map((c) => (
                    <ContactRow
                      key={c.name}
                      primary={(c.contact_name || c.mobile_no || "?").charAt(0).toUpperCase()}
                      title={c.contact_name || c.mobile_no}
                      subtitle={c.mobile_no}
                      badges={[
                        { text: c.has_chat ? "Has chat" : "New", color: c.has_chat ? "text-[#25D366]" : "text-[#ffc107]" },
                        {
                          text: c.within_24h_window ? "In window" : "Template only",
                          color: c.within_24h_window ? "text-[#8696a0]" : "text-[#ffc107]",
                        },
                      ]}
                      onClick={() =>
                        emit({
                          id: c.name,
                          contact_name: c.contact_name,
                          mobile_no: c.mobile_no,
                          has_chat: c.has_chat,
                          within_24h_window: c.within_24h_window,
                          can_send_direct: c.can_send_direct,
                        })
                      }
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Frappe Contacts */}
          {tab === "frappe" && (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input
                  type="text"
                  value={frappeSearch}
                  onChange={(e) => setFrappeSearch(e.target.value)}
                  placeholder="Search Frappe contacts by name or phone..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              <div className="space-y-1">
                {frappeLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
                  </div>
                ) : frappeContacts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[#8696a0] text-sm">
                      {frappeSearch
                        ? "No Frappe contacts found."
                        : "No Frappe contacts found. Add a new one from the 'New Contact' tab."}
                    </p>
                  </div>
                ) : (
                  frappeContacts.map((c) => (
                    <ContactRow
                      key={c.name}
                      primary={(c.contact_name || c.name).charAt(0).toUpperCase()}
                      title={c.contact_name || c.name}
                      subtitle={
                        c.phones.map((p) => p.phone).join(", ") || c.company_name || "No phone"
                      }
                      badges={[
                        {
                          text: c.is_whatsapp_contact ? "Converted" : "Convert",
                          color: c.is_whatsapp_contact ? "text-[#25D366]" : "text-[#ffc107]",
                        },
                      ]}
                      onClick={() => handleConvert(c)}
                      actionLabel={
                        converting === c.name ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
                        ) : undefined
                      }
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 3: New Contact */}
          {tab === "new" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#aebac1] mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Enter contact name"
                  className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#aebac1] mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-sm text-white placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
                <p className="text-xs text-[#8696a0] mt-1">
                  Mobile number with country code
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#2a3942] flex justify-end space-x-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#aebac1] hover:bg-[#2a3942] rounded-lg transition"
          >
            Cancel
          </button>
          {tab === "new" && (
            <button
              onClick={handleCreate}
              disabled={creating || !contactName.trim() || !mobileNo.trim()}
              className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20b859] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Open Chat</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Tabs
const TabButton: React.FC<{
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ active, label, icon, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
      active
        ? "text-[#25D366] border-[#25D366]"
        : "text-[#8696a0] border-transparent hover:text-[#aebac1]"
    }`}
  >
    <span className="flex items-center justify-center gap-1.5">
      {icon}
      {label}
    </span>
  </button>
);

// A reusable contact row with avatar, title, subtitle, badges and optional action.
const ContactRow: React.FC<{
  primary: string;
  title: string;
  subtitle: string;
  badges?: Array<{ text: string; color: string }>;
  onClick: () => void;
  actionLabel?: React.ReactNode;
}> = ({ primary, title, subtitle, badges, onClick, actionLabel }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#2a3942] transition text-left"
  >
    <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-semibold shrink-0">
      {primary}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm text-white font-medium truncate">{title}</div>
      <div className="text-xs text-[#8696a0] truncate">{subtitle}</div>
      {badges && (
        <div className="flex gap-2 mt-0.5">
          {badges.map((b, i) => (
            <span key={i} className={`text-[10px] ${b.color}`}>
              {b.text}
            </span>
          ))}
        </div>
      )}
    </div>
    {actionLabel && <div className="shrink-0">{actionLabel}</div>}
  </button>
);