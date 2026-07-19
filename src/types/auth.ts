export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt?: string | null;
}

export interface SignInInput {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
}

export interface GoogleSignInInput {
  authPage: "login" | "signup";
  next?: string | null;
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signInWithGoogle(input: GoogleSignInInput): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
}
