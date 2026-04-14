export function validateApiKey(key: string): string | null {
  if (!key.trim()) return 'Key is required'
  if (key.trim().length < 10) return 'Key seems too short — check you copied it completely'
  return null
}

export function validateTeamMember(form: { name: string; email?: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  if (form.email && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}

export function validateUser(form: { email: string; password: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.password) {
    errors.password = 'Password is required'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}
