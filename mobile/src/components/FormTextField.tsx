import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { HelperText, TextInput, type TextInputProps } from "react-native-paper";

// Every auth screen needs the same three things wired together for each field: react-hook-form's
// registration, Paper's error styling, and a HelperText that only takes up space once there's
// something to say. Repeating that per field per screen (five screens, ~20 fields) is exactly the
// kind of boilerplate worth collapsing into one component rather than copy-pasted five times.
export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  helperText,
  ...inputProps
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  helperText?: string;
} & Omit<TextInputProps, "value" | "onChangeText" | "onBlur" | "label" | "error">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <>
          <TextInput
            mode="outlined"
            label={label}
            value={typeof value === "string" ? value : ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
            {...inputProps}
          />
          {(error?.message || helperText) && (
            <HelperText type={error ? "error" : "info"} visible>
              {error?.message ?? helperText}
            </HelperText>
          )}
        </>
      )}
    />
  );
}
