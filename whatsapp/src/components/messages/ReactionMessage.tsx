import React from "react";

interface ReactionMessageProps {
  emoji: string;
}

export const ReactionMessage: React.FC<ReactionMessageProps> = ({ emoji }) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm text-[#d1d7db]">Reacted to a message</span>
    </div>
  );
};
