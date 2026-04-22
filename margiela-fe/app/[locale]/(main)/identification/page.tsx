"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { useForm, Controller } from "react-hook-form";
import { format, setMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import Picker from "react-mobile-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getState, setState, type UserInfo } from "@/lib/store";
import { stopAllAudio } from "@/lib/audio";
import { useLocale, useTranslations } from "next-intl";
import countriesData from "@/lib/countries.json";

type CountryRow = { English: string; China: string; Hongkong: string };
const countryOptions: { value: string; labelEn: string; labelZh: string }[] = (
  (countriesData as CountryRow[]).map((c) => ({
    value: c.English.trim(),
    labelEn: c.English.trim(),
    labelZh: c.Hongkong || c.China,
  }))
).sort((a, b) => (a.value === "Hong Kong" ? -1 : b.value === "Hong Kong" ? 1 : 0));

interface FieldInputProps {
  label: string;
  required?: boolean;
  error?: string;
  children: (placeholder: string) => React.ReactNode;
  locale: string;
}

function FieldInput({ label, required, error, children, locale }: FieldInputProps) {
  const placeholder = `${label}${required ? "*" : ""}`;
  return (
    <div className="w-full min-w-0">
      {children(placeholder)}
      {error && (
        <p className="mt-1 font-body text-[14px] text-red-500">{error}</p>
      )}
    </div>
  );
}

const MIN_YEAR = 1925;
const MAX_YEAR = new Date().getFullYear();

function getMonthNames(): { value: number; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(setMonth(new Date(2000, 0, 1), i), "MMMM", { locale: enUS }),
  }));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toBirthdateString(year: number, month: number, day: number): string {
  const daysInMonth = getDaysInMonth(year, month);
  const clampedDay = Math.min(day, daysInMonth);
  const m = String(month).padStart(2, "0");
  const d = String(clampedDay).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

type BirthdateWheelPickerProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  placeholder: string;
  selectBase: string;
  placeholderBase: string;
};

function BirthdateWheelPicker({
  value,
  onChange,
  locale,
  placeholder,
  selectBase,
  placeholderBase,
}: BirthdateWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const monthNames = useMemo(() => getMonthNames(), []);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const parts = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const initialYear = parts[1] ? parts[1] : String(1990);
  const initialMonth = parts[2] ? parts[2] : "1";
  const initialDay = parts[3] ? parts[3] : "1";

  const [pickerValue, setPickerValue] = useState({
    year: initialYear,
    month: initialMonth,
    day: initialDay,
  });

  const daysInMonth = getDaysInMonth(
    parseInt(pickerValue.year, 10),
    parseInt(pickerValue.month, 10)
  );
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const safeDay = dayOptions.includes(pickerValue.day)
    ? pickerValue.day
    : dayOptions[dayOptions.length - 1] ?? "1";
  const displayPickerValue = { ...pickerValue, day: safeDay };
  const yearOptions = Array.from(
    { length: MAX_YEAR - MIN_YEAR + 1 },
    (_, i) => String(MAX_YEAR - i)
  );

  const handleOpen = () => {
    if (value) {
      const p = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (p) {
        setPickerValue({ year: p[1], month: String(parseInt(p[2], 10)), day: String(parseInt(p[3], 10)) });
      }
    }
    setOpen(true);
  };

  const handleDone = () => {
    const y = parseInt(displayPickerValue.year, 10);
    const m = parseInt(displayPickerValue.month, 10);
    const d = Math.min(parseInt(displayPickerValue.day, 10), getDaysInMonth(y, m));
    onChange(toBirthdateString(y, m, d));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handlePickerChange = (newValue: { year: string; month: string; day: string }, key: string) => {
    let valueToSet = newValue;
    if (key === "month" || key === "year") {
      const y = parseInt(newValue.year, 10);
      const m = parseInt(newValue.month, 10);
      const maxDay = getDaysInMonth(y, m);
      const currentDay = parseInt(newValue.day, 10);
      if (currentDay > maxDay) {
        valueToSet = { ...newValue, day: String(maxDay) };
      }
    }
    setPickerValue(valueToSet);
  };

  const displayValue = value
    ? (() => {
        const p = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!p) return value;
        return `${p[3]}/${p[2]}/${p[1]}`;
      })()
    : "";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={!displayValue ? `${placeholderBase} w-full text-left` : `${selectBase} w-full text-left`}
      >
        {displayValue || placeholder}
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#b3b3b3]">
        <svg width="11" height="6" viewBox="0 0 11 6" fill="none">
          <path d="M1 1L5.5 5L10 1" stroke="currentColor" strokeWidth={1.2} />
        </svg>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] safe-area-pb">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
              <button
                type="button"
                onClick={handleClear}
                className="font-body text-[14px] text-[#666]"
              >
                {locale === "zh" ? "清除" : "Clear"}
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="font-body text-[14px] font-semibold text-[#0a0a0a]"
              >
                {locale === "zh" ? "完成" : "Done"}
              </button>
            </div>
            <Picker
              value={displayPickerValue}
              onChange={handlePickerChange}
              height={216}
              itemHeight={36}
              wheelMode="natural"
              className="font-body"
            >
              <Picker.Column key="day" name="day">
                {dayOptions.map((d) => (
                  <Picker.Item key={d} value={d}>
                    {d}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column key="month" name="month">
                {monthNames.map((m) => (
                  <Picker.Item key={m.value} value={String(m.value)}>
                    {m.label}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column key="year" name="year">
                {yearOptions.map((y) => (
                  <Picker.Item key={y} value={y}>
                    {y}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
          </div>
        </>
      )}
    </>
  );
}

export default function IdentificationPage() {
  const router = useRouter();
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const countryInputRef = useRef<HTMLInputElement | null>(null);
  const countryListRef = useRef<HTMLDivElement | null>(null);
  const t = useTranslations("identification");

  const formSchema = useMemo(
    () =>
      z
        .object({
          firstName: z.string().min(1, t("validationFirstName")),
          lastName: z.string().min(1, t("validationLastName")),
          gender: z.string().min(1, t("validationGender")),
          dateOfBirth: z.string().min(1, t("validationDateOfBirth")),
          country: z.string().min(1, t("validationCountry")),
          state: z.string().optional(),
          city: z.string().optional(),
          postcode: z.string().optional(),
          phone: z.string().min(1, t("validationPhone")),
          email: z.string().email(t("validationEmail")),
        })
        .refine(
          (data) => {
            if (!data.dateOfBirth) return true;
            const d = new Date(data.dateOfBirth);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            d.setHours(0, 0, 0, 0);
            return d.getTime() <= today.getTime();
          },
          { message: t("validationDateOfBirthFuture"), path: ["dateOfBirth"] }
        ),
    [t]
  );

  type FormData = z.infer<typeof formSchema>;

  const genderOptions = [
    { value: "male", label: t("genderMale") },
    { value: "female", label: t("genderFemale") },
    { value: "rather-not-say", label: t("genderRatherNot") },
  ];

  useEffect(() => {
    stopAllAudio();
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      gender: "",
      dateOfBirth: "",
      country: "",
      state: "",
      city: "",
      postcode: "",
      phone: "",
      email: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setState({ userInfo: data as UserInfo });
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push("/terms");
  };

  const inputBase =
    "h-[35px] w-full min-w-0 px-3 border border-[#b3b3b3] bg-transparent text-black placeholder:text-[#b3b3b3] focus:border-black focus:outline-none " +
    (locale === "zh"
      ? "font-body text-[16px] tracking-[0.02em]"
      : "font-title text-[15px] font-semibold tracking-[1.5px]");
  const selectBase = inputBase + " appearance-none cursor-pointer pr-8";
  const dateOfBirthPlaceholderBase =
    "h-[35px] w-full min-w-0 px-3 border border-[#b3b3b3] bg-transparent text-[#b3b3b3] focus:border-black focus:outline-none appearance-none cursor-pointer pr-8 " +
    (locale === "zh"
      ? "font-body text-[16px] tracking-[0.02em]"
      : "font-title text-[15px] font-semibold tracking-[1.5px]");

  const getCountryLabel = (value: string) => {
    const opt = countryOptions.find((o) => o.value === value);
    if (!opt) return value;
    return locale === "zh" ? opt.labelZh : opt.labelEn;
  };

  const filteredCountries = useMemo(() => {
    if (!countryQuery.trim()) return countryOptions;
    const q = countryQuery.toLowerCase().trim();
    return countryOptions.filter((opt) => {
      const label = locale === "zh" ? opt.labelZh : opt.labelEn;
      return label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
    });
  }, [countryQuery, locale]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-hide flex flex-col px-5 pt-[24px] pb-12">
        <div className="flex flex-col gap-[24px] w-full px-6 min-w-0 mx-auto">
          <motion.div
            className="flex flex-col gap-[32px] items-center text-center w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className={
                locale === "zh"
                  ? "font-body text-[16px] font-bold tracking-[0.02em] text-black w-full"
                  : "font-title text-[15px] font-semibold tracking-[1.5px] text-black uppercase w-full"
              }
            >
              {t("title")}
            </h1>
            {locale === "zh" ? (
              <div className="flex flex-col gap-px w-full">
                <p className="font-body text-[14px] leading-[20px] tracking-[1.4px] text-black w-full">
                  {t("introLine1")}
                </p>
                <p className="font-body text-[14px] leading-[20px] tracking-[1.4px] text-black w-full">
                  {t("introLine2")}
                </p>
              </div>
            ) : (
              <p className="font-body text-[14px] leading-[1.15] text-black w-full">
                {t("intro")}
              </p>
            )}
          </motion.div>

          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-[24px] items-center w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex flex-col gap-[12px] w-full">
              <div className="flex flex-col gap-[8px] w-full">
                <FieldInput
                  label={t("firstName")}
                  required
                  error={errors.firstName?.message}
                  locale={locale}
                >
                  {(placeholder) => (
                    <input
                      type="text"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("firstName")}
                    />
                  )}
                </FieldInput>

                <FieldInput
                  label={t("lastName")}
                  required
                  error={errors.lastName?.message}
                  locale={locale}
                >
                  {(placeholder) => (
                    <input
                      type="text"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("lastName")}
                    />
                  )}
                </FieldInput>

                <FieldInput label={t("gender")} required error={errors.gender?.message} locale={locale}>
                  {(placeholder) => (
                    <div className="relative w-full">
                      <select
                        className={`${selectBase} ${!watch("gender") ? "!text-[#b3b3b3]" : ""}`}
                        {...register("gender")}
                      >
                        <option value="">{placeholder}</option>
                        {genderOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#b3b3b3]">
                        <svg width="11" height="6" viewBox="0 0 11 6" fill="none">
                          <path d="M1 1L5.5 5L10 1" stroke="currentColor" strokeWidth={1.2} />
                        </svg>
                      </div>
                    </div>
                  )}
                </FieldInput>

                <FieldInput
                  label={t("dateOfBirth")}
                  required
                  error={errors.dateOfBirth?.message}
                  locale={locale}
                >
                  {(placeholder) => (
                    <Controller
                      control={control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <div className="relative w-full">
                          <BirthdateWheelPicker
                            value={field.value}
                            onChange={field.onChange}
                            locale={locale}
                            placeholder={placeholder}
                            selectBase={selectBase}
                            placeholderBase={dateOfBirthPlaceholderBase}
                          />
                        </div>
                      )}
                    />
                  )}
                </FieldInput>

                <FieldInput
                  label={t("country")}
                  required
                  error={errors.country?.message}
                  locale={locale}
                >
                  {(placeholder) => {
                    const countryValue = watch("country");
                    const displayValue = countryOpen
                      ? countryQuery
                      : (countryValue ? getCountryLabel(countryValue) : "");
                    return (
                    <div className="relative w-full">
                      <input
                        type="text"
                        className={inputBase}
                        placeholder={placeholder}
                        autoComplete="off"
                        value={displayValue}
                        onChange={(e) => {
                          setCountryQuery(e.target.value);
                          setCountryOpen(true);
                          if (!e.target.value) setValue("country", "", { shouldValidate: true });
                        }}
                        onFocus={() => setCountryOpen(true)}
                        ref={(el) => {
                          countryInputRef.current = el;
                        }}
                      />
                      {countryOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            aria-hidden
                            onClick={() => setCountryOpen(false)}
                          />
                          <div
                            ref={countryListRef}
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[200px] overflow-auto border border-[#b3b3b3] bg-white shadow-lg"
                          >
                            {filteredCountries.length === 0 ? (
                              <p className="px-3 py-2 font-body text-[14px] text-[#b3b3b3]">
                                {countryQuery.trim() ? t("noResults") : t("searchPlaceholder")}
                              </p>
                              ) : (
                              filteredCountries.map((opt) => {
                                const label = locale === "zh" ? opt.labelZh : opt.labelEn;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className="w-full px-3 py-2 text-left font-body text-[14px] text-black hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none"
                                    onClick={() => {
                                      setValue("country", opt.value, { shouldValidate: true });
                                      setCountryQuery("");
                                      setCountryOpen(false);
                                      countryInputRef.current?.blur();
                                    }}
                                  >
                                    {label}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    );
                  }}
                </FieldInput>

                <FieldInput label={t("state")} error={errors.state?.message} locale={locale}>
                  {(placeholder) => (
                    <input
                      type="text"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("state")}
                    />
                  )}
                </FieldInput>

                <FieldInput label={t("city")} error={errors.city?.message} locale={locale}>
                  {(placeholder) => (
                    <input
                      type="text"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("city")}
                    />
                  )}
                </FieldInput>

                <FieldInput label={t("postcode")} error={errors.postcode?.message} locale={locale}>
                  {(placeholder) => (
                    <input
                      type="text"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("postcode")}
                    />
                  )}
                </FieldInput>

                <FieldInput label={t("phone")} required error={errors.phone?.message} locale={locale}>
                  {(placeholder) => (
                    <input
                      type="tel"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("phone")}
                    />
                  )}
                </FieldInput>

                <FieldInput label={t("email")} required error={errors.email?.message} locale={locale}>
                  {(placeholder) => (
                    <input
                      type="email"
                      className={inputBase}
                      placeholder={placeholder}
                      {...register("email")}
                    />
                  )}
                </FieldInput>
              </div>
              <p
                className={
                  locale === "zh"
                    ? "font-body text-[14px] tracking-[0.02em] text-black"
                    : "font-body text-[14px] text-black"
                }
              >
                {t("requiredFields")}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={
                "w-[240px] h-[36px] bg-black text-white font-title uppercase tracking-[1.5px] hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 " +
                (locale === "zh" ? "text-[16px] font-bold" : "text-[15px] font-semibold")
              }
            >
              {isSubmitting ? t("submitting") : t("continue")}
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
