"use client";

import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

interface CaptchaFieldProps {
  onTokenChange(token: string | null): void;
}

export const CaptchaField = forwardRef<HCaptcha, CaptchaFieldProps>(function CaptchaField(
  { onTokenChange },
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();

  if (!siteKey) {
    return (
      <p className="form-message error" role="alert">
        Bot protection is not configured. Add the hCaptcha site key and reload this page.
      </p>
    );
  }

  return (
    <div className="captcha-field">
      <p>Bot protection</p>
      <HCaptcha
        ref={ref}
        onChalExpired={() => onTokenChange(null)}
        onError={() => onTokenChange(null)}
        onExpire={() => onTokenChange(null)}
        onVerify={(token) => onTokenChange(token)}
        reCaptchaCompat={false}
        sitekey={siteKey}
        size="compact"
      />
      <span className="field-hint">Complete this check before continuing.</span>
    </div>
  );
});
