const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface HeartSlug {
  user: string;
  name: string;
}

export function parseSlug(input: string): HeartSlug {
  const parts = input.split('/');

  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    throw new Error(`Invalid slug "${input}". Expected format: <user>/<name>`);
  }

  const [user, name] = parts;

  if (!NAME_PATTERN.test(user)) {
    throw new Error(`Invalid user name "${user}". Allowed: ${NAME_PATTERN.source}`);
  }
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid heart name "${name}". Allowed: ${NAME_PATTERN.source}`);
  }

  return { user, name };
}
