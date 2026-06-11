import { Mail, Phone, User } from "lucide-react";
import React from "react";

interface ContactMessageProps {
  contact: {
    name?: string;
    phones?: Array<{ phone: string; type?: string }>;
    emails?: Array<{ email: string; type?: string }>;
  };
}

export const ContactMessage: React.FC<ContactMessageProps> = ({ contact }) => {
  return (
    <div className="p-2 bg-black bg-opacity-20 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <User className="w-4 h-4 text-[#25D366]" />
        <span className="text-sm font-medium text-white">
          {contact.name || "Contact"}
        </span>
      </div>
      {contact.phones && contact.phones.length > 0 && (
        <div className="space-y-1 mb-2">
          {contact.phones.map((phone, idx) => (
            <a
              key={idx}
              href={`tel:${phone.phone}`}
              className="flex items-center space-x-2 text-xs text-[#aebac1] hover:text-[#25D366] transition"
            >
              <Phone className="w-3 h-3" />
              <span>{phone.phone}</span>
              {phone.type && (
                <span className="text-[#8696a0]">({phone.type})</span>
              )}
            </a>
          ))}
        </div>
      )}
      {contact.emails && contact.emails.length > 0 && (
        <div className="space-y-1">
          {contact.emails.map((email, idx) => (
            <a
              key={idx}
              href={`mailto:${email.email}`}
              className="flex items-center space-x-2 text-xs text-[#aebac1] hover:text-[#25D366] transition"
            >
              <Mail className="w-3 h-3" />
              <span>{email.email}</span>
              {email.type && (
                <span className="text-[#8696a0]">({email.type})</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
