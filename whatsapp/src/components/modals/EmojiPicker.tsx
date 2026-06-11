import React, { useEffect, useRef, useState } from "react";

interface Category {
  name: string;
  emojis: string[];
}

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  onClose,
  style,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [showFullPicker, setShowFullPicker] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (!showFullPicker) return;

    const loadEmojis = async () => {
      try {
        const response = await fetch("/assets/waba_suite/emojis.json");
        const emojiData = await response.json();

        const categoryKeys = Object.keys(emojiData).filter(
          (key) => key !== "Reactions",
        );

        const builtCategories: Category[] = [];
        for (const category of categoryKeys) {
          if (emojiData[category] && emojiData[category].length) {
            builtCategories.push({
              name: category,
              emojis: emojiData[category],
            });
          }
        }
        setCategories(builtCategories);
        if (builtCategories.length > 0) {
          setActiveCategory(builtCategories[0].name);
        }
      } catch (error) {
        console.error("Failed to load emojis:", error);
      }
    };

    loadEmojis();
  }, [showFullPicker]);

  const handleScroll = () => {
    if (isScrollingRef.current || !listRef.current) return;

    const scrollTop = listRef.current.scrollTop;
    const sections = listRef.current.querySelectorAll("[data-category-id]");

    let currentCategory = activeCategory;
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as HTMLDivElement;
      if (section.offsetTop - 40 <= scrollTop) {
        currentCategory = section.getAttribute("data-category-id") || "";
      } else {
        break;
      }
    }

    if (currentCategory && currentCategory !== activeCategory) {
      setActiveCategory(currentCategory);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    setActiveCategory(categoryName);
    const targetSection = listRef.current?.querySelector(
      `[data-category-id="${categoryName}"]`,
    ) as HTMLDivElement;

    if (targetSection && listRef.current) {
      isScrollingRef.current = true;
      listRef.current.scrollTo({
        top: targetSection.offsetTop,
        behavior: "smooth",
      });

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 250);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[72px] left-4 md:left-[31%] w-[340px] bg-[#202c33] rounded-2xl shadow-2xl border border-[#2a3942] z-[1200] flex flex-col overflow-hidden transition-all duration-200"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-2 bg-[#202c33] border-b border-[#2a3942]">
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
              className="w-9 h-9 text-xl hover:bg-[#2a3942] rounded-full transition flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFullPicker(!showFullPicker)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xl text-[#aebac1] hover:bg-[#2a3942] transition ${
            showFullPicker ? "rotate-45 text-[#25D366]" : ""
          }`}
        >
          ＋
        </button>
      </div>

      {showFullPicker && (
        <>
          <div className="flex flex-wrap gap-1.5 p-2.5 border-b border-[#2a3942] bg-[#202c33] max-h-[76px] overflow-y-auto">
            {categories.map((cat) => {
              const isActive = cat.name === activeCategory;
              return (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`px-2.5 py-1 rounded-full text-xs transition border border-transparent ${
                    isActive
                      ? "bg-[#25D366] text-white"
                      : "text-[#aebac1] hover:bg-[#2a3942] hover:border-[#3b4a54]"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-[220px] overflow-y-auto p-2.5"
          >
            {categories.map((category) => (
              <div
                key={category.name}
                data-category-id={category.name}
                className="mb-4"
              >
                <div className="text-xs font-semibold text-[#aebac1] py-1 px-0.5 mb-2 sticky top-0 bg-[#202c33] z-10">
                  {category.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {category.emojis.map((emoji, index) => (
                    <div
                      key={`${emoji}-${index}`}
                      onClick={() => {
                        onEmojiSelect(emoji);
                        onClose();
                      }}
                      className="text-2xl cursor-pointer p-1 text-center rounded-lg transition hover:bg-[#2a3942] w-[calc((100%-36px)/7)] box-border"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
