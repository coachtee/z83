CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  phone text UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('applicant', 'cafe_staff', 'admin')),
  full_name text NOT NULL,
  email_verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('verifier', 'superadmin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cafe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province text NOT NULL,
  address text,
  contact_email citext,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cafe_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  cafe_account_id uuid NOT NULL REFERENCES cafe_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assisted_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_staff_id uuid NOT NULL REFERENCES cafe_staff(id) ON DELETE CASCADE,
  applicant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assisted_sessions_applicant ON assisted_sessions(applicant_user_id);
CREATE UNIQUE INDEX idx_assisted_sessions_one_open_per_applicant
  ON assisted_sessions(applicant_user_id) WHERE status = 'open';
