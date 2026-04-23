export interface DateFormatOptions {
  /** BCP 47 locale tag used by `Intl.DateTimeFormat`. */
  locale?: string;
  /** Intl formatting options merged with defaults. */
  options?: Intl.DateTimeFormatOptions;
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

/**
 * Format dates consistently for cards and article metadata.
 */
export const formatDisplayDate = (
  date: Date | string | number,
  config: DateFormatOptions = {},
): string => {
  const { locale = "en-GB", options = DEFAULT_OPTIONS } = config;
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
};
