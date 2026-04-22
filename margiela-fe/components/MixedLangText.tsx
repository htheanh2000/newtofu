"use client";

/**
 * When locale is "zh", wraps ASCII letters, numbers, and common symbols
 * (e.g. email, brand names) in Courier Recast Thin. Otherwise renders text as-is.
 */
const SPLIT_REGEX = /([a-zA-Z0-9@._+\-()]+)/g;
const IS_EN_NUM = /^[a-zA-Z0-9@._+\-()]+$/;

export function MixedLangText({
  text,
  locale,
  className = "",
}: {
  text: string;
  locale: string;
  className?: string;
}) {
  if (locale !== "zh") {
    return <span className={className}>{text}</span>;
  }
  const parts = text.split(SPLIT_REGEX);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part && IS_EN_NUM.test(part) ? (
          <span key={i} className="font-courier-recast-thin">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}
