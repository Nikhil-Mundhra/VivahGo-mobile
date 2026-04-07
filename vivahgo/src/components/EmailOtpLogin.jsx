import { useState, useCallback, useEffect, useRef } from 'react';
import { useClerk, useSignIn, useSignUp } from '@clerk/react';

function getErrorPayload(err) {
  if (!err) {
    return null;
  }
  const primary = err.errors?.[0];
  return primary?.longMessage || primary?.message || (typeof err.message === 'string' ? err.message : '');
}

function getResultError(result) {
  if (result && typeof result === 'object' && result.error) {
    return result.error;
  }
  return null;
}

function isIdentifierNotFound(err) {
  const code = err?.errors?.[0]?.code;
  return code === 'form_identifier_not_found' || code === 'identifier_not_found';
}

/** Clerk rejects starting a new sign-in when this client already has an active session. */
function isAlreadySignedInClerkError(err) {
  const text = `${getErrorPayload(err) || ''} ${err?.message || ''}`.toLowerCase();
  if (text.includes('already signed in')) {
    return true;
  }
  const code = err?.errors?.[0]?.code;
  if (typeof code === 'string' && /session|signed|client_state/i.test(code)) {
    return /session_exists|already_signed|signed_in|active_session/i.test(code);
  }
  return false;
}

function isAlreadyVerifiedClerkError(err) {
  const text = `${getErrorPayload(err) || ''} ${err?.message || ''}`.toLowerCase();
  if (text.includes('already been verified') || text.includes('already verified')) {
    return true;
  }
  const code = err?.errors?.[0]?.code;
  return typeof code === 'string' && /already_verified|verification_already_verified/i.test(code);
}

function EmailOtpLogin({ onLoginSuccess, onLoginError }) {
  const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  /** 'sign-in' | 'sign-up' — which Clerk flow will verify the OTP */
  const authFlowRef = useRef('sign-in');
  const onLoginSuccessRef = useRef(onLoginSuccess);
  const isClerkReady = Boolean(clerk.loaded && signIn && signUp);

  useEffect(() => {
    onLoginSuccessRef.current = onLoginSuccess;
  }, [onLoginSuccess]);

  const getClerkErrorMessage = useCallback((err, fallbackMessage) => {
    const msg = getErrorPayload(err);
    return msg || fallbackMessage;
  }, []);

  const completeWithActiveClerkSession = useCallback(async () => {
    const clerk = window.Clerk;
    if (!clerk?.session) {
      return false;
    }
    try {
      const activeToken = await clerk.session.getToken();
      const clerkUser = clerk.user;
      if (!activeToken || !clerkUser) {
        return false;
      }
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
      const displayFromEmail = primaryEmail.split('@')[0] || '';
      const displayName = clerkUser.fullName || displayFromEmail || 'Account';

      onLoginSuccessRef.current({
        id: clerkUser.id || primaryEmail,
        email: primaryEmail,
        name: displayName,
        picture: clerkUser.imageUrl || '',
        given_name: displayFromEmail || displayName,
        family_name: '',
      }, activeToken);
      return true;
    } catch {
      return false;
    }
  }, []);

  const finalizeClerkFlow = useCallback(async (resource, flowType) => {
    if (!resource) {
      return completeWithActiveClerkSession();
    }

    const status = typeof resource.status === 'string' ? resource.status : '';
    if (status === 'complete' || status === 'completed') {
      if (await completeWithActiveClerkSession()) {
        return true;
      }
    }

    const finalizeFn = typeof resource.finalize === 'function'
      ? resource.finalize.bind(resource)
      : flowType === 'sign-up' && typeof signUp?.finalize === 'function'
        ? signUp.finalize.bind(signUp)
        : flowType === 'sign-in' && typeof signIn?.finalize === 'function'
          ? signIn.finalize.bind(signIn)
          : null;

    if (!finalizeFn) {
      return completeWithActiveClerkSession();
    }

    const finalized = await finalizeFn();
    const finalErr = getResultError(finalized);
    if (finalErr) {
      throw finalErr;
    }

    return completeWithActiveClerkSession();
  }, [completeWithActiveClerkSession, signIn, signUp]);

  useEffect(() => {
    if (clerk.loaded) {
      setLoadTimedOut(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setLoadTimedOut(true);
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [clerk.loaded]);

  // If Clerk already has a session (e.g. user refreshed on the login screen), complete app auth and continue.
  useEffect(() => {
    if (!clerk.loaded || !signIn || !signUp) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const clerk = window.Clerk;
      if (!clerk?.session || !clerk.user) {
        return;
      }
      try {
        setLoading(true);
        setError('');
        if (!cancelled) {
          await completeWithActiveClerkSession();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clerk.loaded, signIn, signUp, completeWithActiveClerkSession]);

  const handleGetCode = useCallback(async () => {
    if (!isClerkReady) {
      if (loadTimedOut && typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
      } else {
        setError('Email login is not ready yet. Please wait a moment and try again.');
      }
      return;
    }

    if (!signIn || !signUp) {
      setError('Email login is not ready yet. Please refresh and try again.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setLoading(true);

    const normalizedEmail = email.trim();

    const runSignUpSendCode = async () => {
      const upCreate = await signUp.create({ emailAddress: normalizedEmail });
      const upErr = getResultError(upCreate);
      if (upErr) {
        setError(getClerkErrorMessage(upErr, 'Could not start sign-up. Try again.'));
        onLoginError?.(upErr);
        return false;
      }

      const sendUp = await signUp.verifications.sendEmailCode();
      const sendUpErr = getResultError(sendUp);
      if (sendUpErr) {
        setError(getClerkErrorMessage(sendUpErr, 'Failed to send code. Try again.'));
        onLoginError?.(sendUpErr);
        return false;
      }

      authFlowRef.current = 'sign-up';
      setCodeSent(true);
      return true;
    };

    try {
      // Clerk v6 SignInFuture: create() returns { error }, not a resource — do not use the return value as an attempt.
      const createResult = await signIn.create({ identifier: normalizedEmail });
      const createErr = getResultError(createResult);

      if (createErr && isIdentifierNotFound(createErr)) {
        await runSignUpSendCode();
        return;
      }

      if (createErr && isAlreadySignedInClerkError(createErr)) {
        setError('');
        if (await completeWithActiveClerkSession()) {
          return;
        }
      }

      if (createErr) {
        setError(getClerkErrorMessage(createErr, 'Sign-in could not start. Try again.'));
        onLoginError?.(createErr);
        return;
      }

      const sendIn = await signIn.emailCode.sendCode({ emailAddress: normalizedEmail });
      const sendErr = getResultError(sendIn);
      if (sendErr && isAlreadySignedInClerkError(sendErr)) {
        setError('');
        if (await completeWithActiveClerkSession()) {
          return;
        }
      }
      if (sendErr) {
        setError(getClerkErrorMessage(sendErr, 'Failed to send code. Try again.'));
        onLoginError?.(sendErr);
        return;
      }

      authFlowRef.current = 'sign-in';
      setCodeSent(true);
    } catch (err) {
      // Some Clerk builds reject the promise on HTTP 4xx instead of returning { error }.
      if (isIdentifierNotFound(err)) {
        await runSignUpSendCode();
        return;
      }
      if (isAlreadySignedInClerkError(err)) {
        setError('');
        if (await completeWithActiveClerkSession()) {
          return;
        }
      }
      setError(getClerkErrorMessage(err, 'Failed to send code. Try again.'));
      onLoginError?.(err);
    } finally {
      setLoading(false);
    }
  }, [email, signIn, signUp, onLoginError, getClerkErrorMessage, completeWithActiveClerkSession, isClerkReady, loadTimedOut]);

  const handleVerifyCode = useCallback(async () => {
    if (!signIn || !signUp) {
      setError('Email login is not ready yet. Please refresh and try again.');
      return;
    }

    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setError('');
    setLoading(true);

    const trimmedCode = code.trim();

    try {
      if (authFlowRef.current === 'sign-up') {
        const verifyUp = await signUp.verifications.verifyEmailCode({ code: trimmedCode });
        const verifyErr = getResultError(verifyUp);
        if (verifyErr) {
          setError(getClerkErrorMessage(verifyErr, 'Invalid code. Please try again.'));
          onLoginError?.(verifyErr);
          return;
        }

        const completed = await finalizeClerkFlow(verifyUp, 'sign-up');
        if (!completed) {
          setError('Could not complete sign-up.');
          return;
        }

        const activeToken = await window.Clerk?.session?.getToken?.();
        const clerkUser = window.Clerk?.user;
        const resolvedEmail = clerkUser?.primaryEmailAddress?.emailAddress || normalizedEmailFromState(email);
        const displayName = resolvedEmail.split('@')[0] || resolvedEmail;

        onLoginSuccess({
          id: clerkUser?.id || resolvedEmail,
          email: resolvedEmail,
          name: clerkUser?.fullName || displayName,
          picture: clerkUser?.imageUrl || '',
          given_name: displayName,
          family_name: '',
        }, activeToken || '');
        return;
      }

      const verifyIn = await signIn.emailCode.verifyCode({ code: trimmedCode });
      const verifyErr = getResultError(verifyIn);
      if (verifyErr) {
        setError(getClerkErrorMessage(verifyErr, 'Invalid code. Please try again.'));
        onLoginError?.(verifyErr);
        return;
      }

      const completed = await finalizeClerkFlow(verifyIn, 'sign-in');
      if (!completed) {
        setError('Could not complete sign-in.');
        return;
      }

      const activeToken = await window.Clerk?.session?.getToken?.();
      const clerkUser = window.Clerk?.user;
      const resolvedEmail = clerkUser?.primaryEmailAddress?.emailAddress || normalizedEmailFromState(email);
      const displayName = resolvedEmail.split('@')[0] || resolvedEmail;

      onLoginSuccess({
        id: clerkUser?.id || resolvedEmail,
        email: resolvedEmail,
        name: clerkUser?.fullName || displayName,
        picture: clerkUser?.imageUrl || '',
        given_name: displayName,
        family_name: '',
      }, activeToken || '');
    } catch (err) {
      if (isAlreadySignedInClerkError(err) || isAlreadyVerifiedClerkError(err)) {
        setError('');
        if (await completeWithActiveClerkSession()) {
          return;
        }
      }
      setError(getClerkErrorMessage(err, 'Invalid code. Please try again.'));
      onLoginError?.(err);
    } finally {
      setLoading(false);
    }
  }, [code, email, signIn, signUp, onLoginSuccess, onLoginError, getClerkErrorMessage, completeWithActiveClerkSession, finalizeClerkFlow]);

  if (!clerkPublishableKey) {
    return null;
  }

  return (
    <div className="email-otp-login">
      {!codeSent ? (
        <div className="email-otp-get-code-row">
          <input
            className="email-otp-input"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading || !isClerkReady}
            autoComplete="email"
          />
          <button
            className="email-otp-btn"
            type="button"
            onClick={handleGetCode}
            disabled={loading || (!isClerkReady ? !loadTimedOut : !email.trim())}
          >
            {!isClerkReady ? (loadTimedOut ? 'Retry' : 'Loading...') : loading ? 'Sending...' : 'Get code'}
          </button>
        </div>
      ) : (
        <div className="email-otp-verify-row">
          <input
            className="email-otp-input email-otp-otp-input"
            type="text"
            inputMode="numeric"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={e => setCode(e.target.value)}
            disabled={loading}
            autoComplete="one-time-code"
          />
          <button
            className="email-otp-btn"
            type="button"
            onClick={handleVerifyCode}
            disabled={loading || !code.trim()}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      )}
      <div className="email-otp-captcha-shell" aria-live="polite">
        <div
          id="clerk-captcha"
          data-cl-theme="auto"
          data-cl-size="flexible"
        />
      </div>
      {!isClerkReady && !error && (
        <div className="email-otp-hint">
          {loadTimedOut ? 'Email login took too long to initialize. Refresh the page and try again.' : 'Email login is loading...'}
        </div>
      )}
      {error && <div className="email-otp-error">{error}</div>}
      {codeSent && (
        <p className="email-otp-hint">
          Check your inbox for a 6-digit code.{' '}
          <button
            className="email-otp-resend"
            type="button"
            onClick={handleGetCode}
            disabled={loading}
          >
            Resend
          </button>
        </p>
      )}
    </div>
  );
}

function normalizedEmailFromState(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default EmailOtpLogin;
